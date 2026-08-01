import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { INestApplication } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { VehicleDataSource } from '../src/domain/vehicles/application/gateways/vehicle-data-source';
import { VehicleMakeRepository } from '../src/domain/vehicles/application/repositories/vehicle-make.repository';
import { CountMakesUseCase } from '../src/domain/vehicles/application/use-cases/count-makes';
import { GetMakeUseCase } from '../src/domain/vehicles/application/use-cases/get-make';
import { IngestVehicleDataUseCase } from '../src/domain/vehicles/application/use-cases/ingest-vehicle-data';
import { ListMakesUseCase } from '../src/domain/vehicles/application/use-cases/list-makes';
import { VehicleMakesResolver } from '../src/infra/http/vehicle-makes.resolver';
import { InMemoryVehicleMakeRepository } from './repositories/in-memory-vehicle-make.repository';

const dataSourceStub: VehicleDataSource = {
  getAllMakes: async () => [
    { makeId: 440, makeName: 'ASTON MARTIN' },
    { makeId: 441, makeName: 'TESLA' },
  ],
  getVehicleTypesForMake: async (makeId: number) =>
    makeId === 440
      ? [{ typeId: 2, typeName: 'Passenger Car' }]
      : [
          { typeId: 2, typeName: 'Passenger Car' },
          { typeId: 7, typeName: 'Multipurpose Passenger Vehicle (MPV)' },
        ],
};

describe('GraphQL API (e2e)', () => {
  let app: INestApplication;

  const graphql = (query: string) => request(app.getHttpServer()).post('/graphql').send({ query });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({ driver: ApolloDriver, autoSchemaFile: true }),
      ],
      providers: [
        { provide: VehicleMakeRepository, useClass: InMemoryVehicleMakeRepository },
        { provide: VehicleDataSource, useValue: dataSourceStub },
        ListMakesUseCase,
        GetMakeUseCase,
        CountMakesUseCase,
        {
          provide: IngestVehicleDataUseCase,
          inject: [VehicleDataSource, VehicleMakeRepository],
          useFactory: (dataSource: VehicleDataSource, repository: VehicleMakeRepository) =>
            new IngestVehicleDataUseCase(
              dataSource,
              repository,
              { concurrency: 10, makesLimit: 0 },
              { log: () => {}, error: () => {} },
            ),
        },
        VehicleMakesResolver,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('ingests data end-to-end and serves it over GraphQL', async () => {
    const ingestResponse = await graphql(`
      mutation {
        ingestVehicleData {
          makesIngested
          makesFailed
        }
      }
    `).expect(200);
    expect(ingestResponse.body.data.ingestVehicleData).toMatchObject({
      makesIngested: 2,
      makesFailed: 0,
    });

    const makesResponse = await graphql(`
      query {
        makes {
          makeId
          makeName
          vehicleTypes {
            typeId
            typeName
          }
        }
      }
    `).expect(200);
    expect(makesResponse.body.data.makes).toEqual([
      {
        makeId: 440,
        makeName: 'ASTON MARTIN',
        vehicleTypes: [{ typeId: 2, typeName: 'Passenger Car' }],
      },
      {
        makeId: 441,
        makeName: 'TESLA',
        vehicleTypes: [
          { typeId: 2, typeName: 'Passenger Car' },
          { typeId: 7, typeName: 'Multipurpose Passenger Vehicle (MPV)' },
        ],
      },
    ]);
  });

  it('serves a single make by id', async () => {
    const response = await graphql(`
      query {
        make(makeId: 440) {
          makeName
        }
      }
    `).expect(200);
    expect(response.body.data.make).toEqual({ makeName: 'ASTON MARTIN' });
  });

  it('returns null for an unknown make', async () => {
    const response = await graphql(`
      query {
        make(makeId: 999) {
          makeName
        }
      }
    `).expect(200);
    expect(response.body.data.make).toBeNull();
  });

  it('paginates makes', async () => {
    const response = await graphql(`
      query {
        makes(limit: 1, offset: 1) {
          makeId
        }
      }
    `).expect(200);
    expect(response.body.data.makes).toEqual([{ makeId: 441 }]);
  });

  it('clamps out-of-range pagination arguments', async () => {
    const zeroLimit = await graphql(`
      query {
        makes(limit: 0, offset: -5) {
          makeId
        }
      }
    `).expect(200);
    expect(zeroLimit.body.data.makes).toEqual([{ makeId: 440 }]);

    const hugeLimit = await graphql(`
      query {
        makes(limit: 5000) {
          makeId
        }
      }
    `).expect(200);
    expect(hugeLimit.body.data.makes).toHaveLength(2);
  });

  it('reports the total number of stored makes', async () => {
    const response = await graphql(`
      query {
        makesCount
      }
    `).expect(200);
    expect(response.body.data.makesCount).toBe(2);
  });
});
