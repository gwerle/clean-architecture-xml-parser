import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VehicleDataSource } from '../../domain/vehicles/application/gateways/vehicle-data-source';
import { VehicleMakeRepository } from '../../domain/vehicles/application/repositories/vehicle-make.repository';
import { CountMakesUseCase } from '../../domain/vehicles/application/use-cases/count-makes';
import { GetMakeUseCase } from '../../domain/vehicles/application/use-cases/get-make';
import { IngestVehicleDataUseCase } from '../../domain/vehicles/application/use-cases/ingest-vehicle-data';
import { ListMakesUseCase } from '../../domain/vehicles/application/use-cases/list-makes';
import { DatabaseModule } from '../database/database.module';
import { ScheduledIngestionService } from '../ingestion/scheduled-ingestion.service';
import { NhtsaModule } from '../nhtsa/nhtsa.module';
import { VehicleMakesResolver } from './vehicle-makes.resolver';

@Module({
  imports: [DatabaseModule, NhtsaModule],
  providers: [
    ListMakesUseCase,
    GetMakeUseCase,
    CountMakesUseCase,
    {
      provide: IngestVehicleDataUseCase,
      inject: [VehicleDataSource, VehicleMakeRepository, ConfigService],
      useFactory: (
        dataSource: VehicleDataSource,
        repository: VehicleMakeRepository,
        config: ConfigService,
      ) =>
        new IngestVehicleDataUseCase(
          dataSource,
          repository,
          {
            concurrency: config.get<number>('NHTSA_CONCURRENCY', 10),
            makesLimit: config.get<number>('INGEST_MAKES_LIMIT', 0),
          },
          new Logger(IngestVehicleDataUseCase.name),
        ),
    },
    ScheduledIngestionService,
    VehicleMakesResolver,
  ],
})
export class HttpModule {}
