import { MakeSummary, VehicleType } from '../../enterprise/entities/vehicle-make';

export abstract class VehicleDataSource {
  abstract getAllMakes(): Promise<MakeSummary[]>;
  abstract getVehicleTypesForMake(makeId: number): Promise<VehicleType[]>;
}
