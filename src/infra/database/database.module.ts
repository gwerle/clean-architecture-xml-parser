import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { VehicleMakeRepository } from '../../domain/vehicles/application/repositories/vehicle-make.repository';
import { MongoVehicleMakeRepository } from './mongoose/vehicle-make.mongo-repository';
import { VehicleMakeDocument, VehicleMakeSchema } from './mongoose/vehicle-make.schema';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ uri: config.get<string>('MONGODB_URI') }),
    }),
    MongooseModule.forFeature([{ name: VehicleMakeDocument.name, schema: VehicleMakeSchema }]),
  ],
  providers: [{ provide: VehicleMakeRepository, useClass: MongoVehicleMakeRepository }],
  exports: [VehicleMakeRepository],
})
export class DatabaseModule {}
