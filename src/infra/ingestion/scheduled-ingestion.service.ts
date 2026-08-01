import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IngestVehicleDataUseCase } from '../../domain/vehicles/application/use-cases/ingest-vehicle-data';

@Injectable()
export class ScheduledIngestionService {
  private readonly logger = new Logger(ScheduledIngestionService.name);

  constructor(private readonly ingestVehicleData: IngestVehicleDataUseCase) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async run(): Promise<void> {
    this.logger.log('Starting scheduled ingestion');
    try {
      await this.ingestVehicleData.execute();
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Scheduled ingestion failed: ${err.message}`, err.stack);
    }
  }
}
