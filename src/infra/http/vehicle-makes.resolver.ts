import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { CountMakesUseCase } from '../../domain/vehicles/application/use-cases/count-makes';
import { GetMakeUseCase } from '../../domain/vehicles/application/use-cases/get-make';
import {
  IngestionAlreadyRunningError,
  IngestionSummary,
  IngestVehicleDataUseCase,
} from '../../domain/vehicles/application/use-cases/ingest-vehicle-data';
import { ListMakesUseCase } from '../../domain/vehicles/application/use-cases/list-makes';
import { VehicleMake } from '../../domain/vehicles/enterprise/entities/vehicle-make';
import { IngestionSummaryObject, MakeObject } from './vehicle-make.objects';

const MAX_LIMIT = 1000;

@Resolver(() => MakeObject)
export class VehicleMakesResolver {
  constructor(
    private readonly listMakes: ListMakesUseCase,
    private readonly getMake: GetMakeUseCase,
    private readonly countMakes: CountMakesUseCase,
    private readonly ingestVehicleDataUseCase: IngestVehicleDataUseCase,
  ) {}

  @Query(() => [MakeObject], {
    description: 'Vehicle makes with their vehicle types, ordered by makeId. Paginated.',
  })
  async makes(
    @Args('limit', {
      type: () => Int,
      defaultValue: 100,
      description: `Page size, max ${MAX_LIMIT}.`,
    })
    limit: number,
    @Args('offset', { type: () => Int, defaultValue: 0, description: 'Number of makes to skip.' })
    offset: number,
  ): Promise<VehicleMake[]> {
    return this.listMakes.execute(Math.min(Math.max(limit, 1), MAX_LIMIT), Math.max(offset, 0));
  }

  @Query(() => MakeObject, { nullable: true, description: 'A single make by its NHTSA make id.' })
  async make(@Args('makeId', { type: () => Int }) makeId: number): Promise<VehicleMake | null> {
    return this.getMake.execute(makeId);
  }

  @Query(() => Int, { description: 'Total number of makes stored.' })
  async makesCount(): Promise<number> {
    return this.countMakes.execute();
  }

  @Mutation(() => IngestionSummaryObject, {
    description:
      'Fetches all makes and their vehicle types from NHTSA, transforms the XML to JSON and persists it. Existing makes are upserted in place; makes no longer returned by NHTSA are kept.',
  })
  async ingestVehicleData(): Promise<IngestionSummary> {
    try {
      return await this.ingestVehicleDataUseCase.execute();
    } catch (error) {
      if (error instanceof IngestionAlreadyRunningError) {
        // GraphQL answers 200 either way, so the code is what clients branch on.
        throw new GraphQLError(error.message, { extensions: { code: 'CONFLICT' } });
      }
      throw error;
    }
  }
}
