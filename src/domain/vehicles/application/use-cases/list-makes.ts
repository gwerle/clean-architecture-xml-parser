import { Injectable } from '@nestjs/common';
import { VehicleMake } from '../../enterprise/entities/vehicle-make';
import { VehicleMakeRepository } from '../repositories/vehicle-make.repository';

@Injectable()
export class ListMakesUseCase {
  constructor(private readonly repository: VehicleMakeRepository) {}

  execute(limit: number, offset: number): Promise<VehicleMake[]> {
    return this.repository.findAll(limit, offset);
  }
}
