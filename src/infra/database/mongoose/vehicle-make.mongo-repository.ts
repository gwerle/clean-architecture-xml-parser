import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { chunk } from '../../../core/utils/chunk';
import { VehicleMakeRepository } from '../../../domain/vehicles/application/repositories/vehicle-make.repository';
import { VehicleMake } from '../../../domain/vehicles/enterprise/entities/vehicle-make';
import { VehicleMakeDocument } from './vehicle-make.schema';

@Injectable()
export class MongoVehicleMakeRepository extends VehicleMakeRepository {
  constructor(
    @InjectModel(VehicleMakeDocument.name)
    private readonly model: Model<VehicleMakeDocument>,
  ) {
    super();
  }

  async upsertMany(makes: VehicleMake[]): Promise<void> {
    for (const batch of chunk(makes, 1000)) {
      await this.model.bulkWrite(
        batch.map((make) => ({
          replaceOne: { filter: { makeId: make.makeId }, replacement: make, upsert: true },
        })),
        { ordered: false },
      );
    }
  }

  async findAll(limit: number, offset: number): Promise<VehicleMake[]> {
    return this.model.find().sort({ makeId: 1 }).skip(offset).limit(limit).lean<VehicleMake[]>();
  }

  async findById(makeId: number): Promise<VehicleMake | null> {
    return this.model.findOne({ makeId }).lean<VehicleMake>();
  }

  async count(): Promise<number> {
    return this.model.countDocuments();
  }
}
