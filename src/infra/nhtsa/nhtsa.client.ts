import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VehicleDataSource } from '../../domain/vehicles/application/gateways/vehicle-data-source';
import { MakeSummary, VehicleType } from '../../domain/vehicles/enterprise/entities/vehicle-make';
import { parseAllMakesXml, parseVehicleTypesXml } from './vehicle-data.transformer';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Everything else (404, 400, ...) will fail again just as fast on a retry.
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`NHTSA responded with status ${status}`);
  }
}

@Injectable()
export class NhtsaClient extends VehicleDataSource {
  private readonly logger = new Logger(NhtsaClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(config: ConfigService) {
    super();
    this.baseUrl = config.get<string>('NHTSA_API_BASE_URL', '');
    this.timeoutMs = config.get<number>('NHTSA_TIMEOUT_MS', 10000);
    this.maxRetries = config.get<number>('NHTSA_MAX_RETRIES', 3);
    this.retryDelayMs = config.get<number>('NHTSA_RETRY_DELAY_MS', 500);
  }

  async getAllMakes(): Promise<MakeSummary[]> {
    return parseAllMakesXml(await this.fetchXml('getallmakes?format=xml'));
  }

  async getVehicleTypesForMake(makeId: number): Promise<VehicleType[]> {
    return parseVehicleTypesXml(
      await this.fetchXml(`GetVehicleTypesForMakeId/${makeId}?format=xml`),
    );
  }

  private async fetchXml(path: string): Promise<string> {
    const url = `${this.baseUrl}/${path}`;
    let lastError: unknown;
    let attempts = 0;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        await sleep(this.backoffMs(attempt));
        this.logger.warn(
          `Retrying NHTSA request (attempt ${attempt + 1}/${this.maxRetries + 1}): ${url}`,
        );
      }
      attempts += 1;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
        if (!response.ok) {
          throw new HttpStatusError(response.status);
        }
        return await response.text();
      } catch (error) {
        lastError = error;
        if (error instanceof HttpStatusError && !RETRYABLE_STATUSES.has(error.status)) {
          break;
        }
      }
    }
    this.logger.error(
      `NHTSA request failed after ${attempts} attempt(s): ${url} (${(lastError as Error)?.message})`,
    );
    // The URL stays in the log, not in the error surfaced to API clients.
    throw new Error(`NHTSA request failed after ${attempts} attempt(s)`, { cause: lastError });
  }

  /** Exponential backoff with jitter, so parallel failures don't retry in lockstep. */
  private backoffMs(attempt: number): number {
    const delay = this.retryDelayMs * 2 ** (attempt - 1);
    return delay / 2 + Math.random() * (delay / 2);
  }
}
