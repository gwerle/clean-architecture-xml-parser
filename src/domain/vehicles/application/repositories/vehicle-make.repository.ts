import { VehicleMake } from '../../enterprise/entities/vehicle-make';

export abstract class VehicleMakeRepository {
  abstract upsertMany(makes: VehicleMake[]): Promise<void>;
  abstract findAll(limit: number, offset: number): Promise<VehicleMake[]>;
  abstract findById(makeId: number): Promise<VehicleMake | null>;
  abstract count(): Promise<number>;
}
