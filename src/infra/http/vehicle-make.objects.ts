import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('VehicleType', { description: 'A vehicle type produced by a make.' })
export class VehicleTypeObject {
  @Field(() => Int, { description: 'NHTSA vehicle type id.' })
  typeId!: number;

  @Field({ description: 'Vehicle type name, e.g. "Passenger Car".' })
  typeName!: string;
}

@ObjectType('Make', { description: 'A vehicle make with its associated vehicle types.' })
export class MakeObject {
  @Field(() => Int, { description: 'NHTSA make id.' })
  makeId!: number;

  @Field({ description: 'Make name, e.g. "ASTON MARTIN".' })
  makeName!: string;

  @Field(() => [VehicleTypeObject], { description: 'Vehicle types this make produces.' })
  vehicleTypes!: VehicleTypeObject[];
}

@ObjectType('IngestionSummary', { description: 'Result of an ingestion run.' })
export class IngestionSummaryObject {
  @Field(() => Int, { description: 'Number of makes successfully ingested.' })
  makesIngested!: number;

  @Field(() => Int, { description: 'Number of makes that failed and were skipped.' })
  makesFailed!: number;

  @Field(() => Int, { description: 'Total ingestion duration in milliseconds.' })
  durationMs!: number;
}
