import { Injectable } from '@nestjs/common';
import { VehicleMake } from '../../enterprise/entities/vehicle-make';
import { VehicleMakeRepository } from '../repositories/vehicle-make.repository';

@Injectable()
export class GetMakeUseCase {
  constructor(private readonly repository: VehicleMakeRepository) {}

  execute(makeId: number): Promise<VehicleMake | null> {
    return this.repository.findById(makeId);
  }
}
