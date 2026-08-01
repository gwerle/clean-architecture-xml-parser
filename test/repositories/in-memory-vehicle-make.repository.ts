import { VehicleMakeRepository } from '../../src/domain/vehicles/application/repositories/vehicle-make.repository';
import { VehicleMake } from '../../src/domain/vehicles/enterprise/entities/vehicle-make';

export class InMemoryVehicleMakeRepository extends VehicleMakeRepository {
  private readonly store = new Map<number, VehicleMake>();

  async upsertMany(makes: VehicleMake[]): Promise<void> {
    makes.forEach((make) => this.store.set(make.makeId, make));
  }

  async findAll(limit: number, offset: number): Promise<VehicleMake[]> {
    return [...this.store.values()]
      .sort((a, b) => a.makeId - b.makeId)
      .slice(offset, offset + limit);
  }

  async findById(makeId: number): Promise<VehicleMake | null> {
    return this.store.get(makeId) ?? null;
  }

  async count(): Promise<number> {
    return this.store.size;
  }
}
