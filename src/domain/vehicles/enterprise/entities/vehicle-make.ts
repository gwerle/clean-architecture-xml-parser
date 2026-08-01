export interface VehicleType {
  typeId: number;
  typeName: string;
}

export interface VehicleMake {
  makeId: number;
  makeName: string;
  vehicleTypes: VehicleType[];
}

export type MakeSummary = Omit<VehicleMake, 'vehicleTypes'>;
