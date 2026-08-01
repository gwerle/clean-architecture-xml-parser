import { MakeSummary, VehicleMake } from '../../enterprise/entities/vehicle-make';
import { VehicleDataSource } from '../gateways/vehicle-data-source';
import { VehicleMakeRepository } from '../repositories/vehicle-make.repository';
import {
  IngestionAlreadyRunningError,
  IngestionConfig,
  IngestionLogger,
  IngestVehicleDataUseCase,
} from './ingest-vehicle-data';

const makes: MakeSummary[] = [
  { makeId: 440, makeName: 'ASTON MARTIN' },
  { makeId: 441, makeName: 'TESLA' },
];

const logger: IngestionLogger = { log: () => {}, error: () => {} };

function config(overrides: Partial<IngestionConfig> = {}): IngestionConfig {
  return { concurrency: 10, makesLimit: 0, ...overrides };
}

describe('IngestVehicleDataUseCase', () => {
  let dataSource: jest.Mocked<VehicleDataSource>;
  let repository: jest.Mocked<VehicleMakeRepository>;

  const useCaseWith = (overrides: Partial<IngestionConfig> = {}) =>
    new IngestVehicleDataUseCase(dataSource, repository, config(overrides), logger);

  const persisted = () =>
    repository.upsertMany.mock.calls.flatMap(([batch]) => batch as VehicleMake[]);

  beforeEach(() => {
    dataSource = {
      getAllMakes: jest.fn().mockResolvedValue(makes),
      getVehicleTypesForMake: jest
        .fn()
        .mockResolvedValue([{ typeId: 2, typeName: 'Passenger Car' }]),
    };
    repository = {
      upsertMany: jest.fn().mockResolvedValue(undefined),
      findAll: jest.fn(),
      findById: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
  });

  it('combines makes with their vehicle types and persists the unified result', async () => {
    const summary = await useCaseWith().execute();

    expect(persisted()).toEqual(
      expect.arrayContaining([
        {
          makeId: 440,
          makeName: 'ASTON MARTIN',
          vehicleTypes: [{ typeId: 2, typeName: 'Passenger Car' }],
        },
        {
          makeId: 441,
          makeName: 'TESLA',
          vehicleTypes: [{ typeId: 2, typeName: 'Passenger Car' }],
        },
      ]),
    );
    expect(summary).toMatchObject({ makesIngested: 2, makesFailed: 0 });
  });

  it('skips failing makes and reports them without aborting the run', async () => {
    dataSource.getVehicleTypesForMake.mockImplementation((makeId) =>
      makeId === 440
        ? Promise.reject(new Error('boom'))
        : Promise.resolve([{ typeId: 2, typeName: 'Passenger Car' }]),
    );

    const summary = await useCaseWith().execute();

    expect(summary).toMatchObject({ makesIngested: 1, makesFailed: 1 });
    expect(persisted()).toHaveLength(1);
  });

  it('respects the makes limit', async () => {
    const summary = await useCaseWith({ makesLimit: 1 }).execute();

    expect(summary.makesIngested).toBe(1);
    expect(dataSource.getVehicleTypesForMake).toHaveBeenCalledTimes(1);
  });

  it('rejects concurrent ingestion runs', async () => {
    let release!: (value: MakeSummary[]) => void;
    dataSource.getAllMakes.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const useCase = useCaseWith();

    const first = useCase.execute();
    await expect(useCase.execute()).rejects.toThrow(IngestionAlreadyRunningError);
    release([]);
    await first;
  });

  it('persists progressively instead of only at the end', async () => {
    dataSource.getAllMakes.mockResolvedValue(
      Array.from({ length: 600 }, (_, i) => ({ makeId: i, makeName: `MAKE ${i}` })),
    );

    const summary = await useCaseWith().execute();

    expect(repository.upsertMany.mock.calls.length).toBeGreaterThan(1);
    expect(summary.makesIngested).toBe(600);
  });

  it('stops fetching as soon as a write fails instead of leaving workers running', async () => {
    dataSource.getAllMakes.mockResolvedValue(
      Array.from({ length: 2000 }, (_, i) => ({ makeId: i, makeName: `MAKE ${i}` })),
    );
    repository.upsertMany.mockRejectedValue(new Error('mongo is down'));

    await expect(useCaseWith().execute()).rejects.toThrow('mongo is down');
    expect(dataSource.getVehicleTypesForMake.mock.calls.length).toBeLessThan(2000);
  });

  it('keeps already-written makes and rethrows when a write fails', async () => {
    dataSource.getAllMakes.mockResolvedValue(
      Array.from({ length: 600 }, (_, i) => ({ makeId: i, makeName: `MAKE ${i}` })),
    );
    repository.upsertMany
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error('mongo is down'));

    await expect(useCaseWith().execute()).rejects.toThrow('mongo is down');
    // The first batch landed before the failure and stays in the datastore.
    expect(repository.upsertMany.mock.calls[0][0]).toHaveLength(500);
  });
});
