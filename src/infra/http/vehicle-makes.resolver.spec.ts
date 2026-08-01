import { GraphQLError } from 'graphql';
import { CountMakesUseCase } from '../../domain/vehicles/application/use-cases/count-makes';
import { GetMakeUseCase } from '../../domain/vehicles/application/use-cases/get-make';
import {
  IngestionAlreadyRunningError,
  IngestVehicleDataUseCase,
} from '../../domain/vehicles/application/use-cases/ingest-vehicle-data';
import { ListMakesUseCase } from '../../domain/vehicles/application/use-cases/list-makes';
import { VehicleMakesResolver } from './vehicle-makes.resolver';

describe('VehicleMakesResolver', () => {
  const resolverWith = (execute: jest.Mock) =>
    new VehicleMakesResolver(
      {} as ListMakesUseCase,
      {} as GetMakeUseCase,
      {} as CountMakesUseCase,
      { execute } as unknown as IngestVehicleDataUseCase,
    );

  it('maps a concurrent ingestion attempt to a CONFLICT error', async () => {
    const resolver = resolverWith(jest.fn().mockRejectedValue(new IngestionAlreadyRunningError()));

    await expect(resolver.ingestVehicleData()).rejects.toThrow(GraphQLError);
    await expect(resolver.ingestVehicleData()).rejects.toMatchObject({
      extensions: { code: 'CONFLICT' },
    });
  });

  it('lets other ingestion failures through untouched', async () => {
    const resolver = resolverWith(jest.fn().mockRejectedValue(new Error('NHTSA request failed')));

    await expect(resolver.ingestVehicleData()).rejects.toThrow('NHTSA request failed');
  });
});
