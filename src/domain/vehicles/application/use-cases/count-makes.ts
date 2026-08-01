import { Injectable } from '@nestjs/common';
import { VehicleMakeRepository } from '../repositories/vehicle-make.repository';

@Injectable()
export class CountMakesUseCase {
  constructor(private readonly repository: VehicleMakeRepository) {}

  execute(): Promise<number> {
    return this.repository.count();
  }
}
