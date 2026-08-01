import { Injectable } from '@nestjs/common';
import { VehicleMake } from '../../enterprise/entities/vehicle-make';
import { VehicleDataSource } from '../gateways/vehicle-data-source';
import { VehicleMakeRepository } from '../repositories/vehicle-make.repository';

// Persist as we go: a crash mid-run keeps everything already fetched.
const FLUSH_SIZE = 500;
const PROGRESS_EVERY = 1000;

export interface IngestionSummary {
  makesIngested: number;
  makesFailed: number;
  durationMs: number;
}

export interface IngestionConfig {
  concurrency: number;
  makesLimit: number;
}

export interface IngestionLogger {
  log(message: string): void;
  error(message: string): void;
}

export class IngestionAlreadyRunningError extends Error {
  constructor() {
    super('Ingestion is already running');
  }
}

@Injectable()
export class IngestVehicleDataUseCase {
  private running = false;

  constructor(
    private readonly dataSource: VehicleDataSource,
    private readonly repository: VehicleMakeRepository,
    private readonly config: IngestionConfig,
    private readonly logger: IngestionLogger,
  ) {}

  async execute(): Promise<IngestionSummary> {
    if (this.running) {
      throw new IngestionAlreadyRunningError();
    }
    this.running = true;
    const startedAt = Date.now();
    try {
      this.logger.log('Ingestion started');
      const allMakes = await this.dataSource.getAllMakes();
      const makes =
        this.config.makesLimit > 0 ? allMakes.slice(0, this.config.makesLimit) : allMakes;
      this.logger.log(`Fetching vehicle types for ${makes.length} makes`);

      let ingested = 0;
      let failed = 0;
      let processed = 0;
      let next = 0;
      let buffer: VehicleMake[] = [];
      let failure: unknown;

      const flush = async (): Promise<void> => {
        if (buffer.length === 0) {
          return;
        }
        const batch = buffer;
        buffer = [];
        await this.repository.upsertMany(batch);
        ingested += batch.length;
      };

      // Workers pull from a shared cursor, so all `concurrency` requests stay in
      // flight instead of waiting on the slowest member of a batch.
      const worker = async (): Promise<void> => {
        while (next < makes.length && failure === undefined) {
          const make = makes[next++];
          try {
            const vehicleTypes = await this.dataSource.getVehicleTypesForMake(make.makeId);
            buffer.push({ ...make, vehicleTypes });
          } catch (error) {
            failed += 1;
            this.logger.error(
              `Failed to fetch vehicle types for make ${make.makeId} (${make.makeName}): ${(error as Error).message}`,
            );
          }
          if (++processed % PROGRESS_EVERY === 0) {
            this.logger.log(`Progress: ${processed}/${makes.length} makes`);
          }
          if (buffer.length >= FLUSH_SIZE) {
            await flush();
          }
        }
      };

      await Promise.all(
        Array.from({ length: this.config.concurrency }, () =>
          worker().catch((error: unknown) => {
            failure ??= error;
          }),
        ),
      );
      if (failure !== undefined) {
        throw failure;
      }
      await flush();

      const summary: IngestionSummary = {
        makesIngested: ingested,
        makesFailed: failed,
        durationMs: Date.now() - startedAt,
      };
      this.logger.log(`Ingestion finished: ${JSON.stringify(summary)}`);
      return summary;
    } finally {
      this.running = false;
    }
  }
}
