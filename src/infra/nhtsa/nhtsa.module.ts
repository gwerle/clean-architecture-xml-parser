import { Module } from '@nestjs/common';
import { VehicleDataSource } from '../../domain/vehicles/application/gateways/vehicle-data-source';
import { NhtsaClient } from './nhtsa.client';

@Module({
  providers: [{ provide: VehicleDataSource, useClass: NhtsaClient }],
  exports: [VehicleDataSource],
})
export class NhtsaModule {}
