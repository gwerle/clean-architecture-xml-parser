import { Model } from 'mongoose';
import { VehicleMake } from '../../../domain/vehicles/enterprise/entities/vehicle-make';
import { MongoVehicleMakeRepository } from './vehicle-make.mongo-repository';
import { VehicleMakeDocument } from './vehicle-make.schema';

const make = (makeId: number): VehicleMake => ({
  makeId,
  makeName: `MAKE ${makeId}`,
  vehicleTypes: [{ typeId: 2, typeName: 'Passenger Car' }],
});

describe('MongoVehicleMakeRepository', () => {
  let model: {
    bulkWrite: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    countDocuments: jest.Mock;
  };
  let repository: MongoVehicleMakeRepository;

  beforeEach(() => {
    model = {
      bulkWrite: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(3),
    };
    repository = new MongoVehicleMakeRepository(model as unknown as Model<VehicleMakeDocument>);
  });

  describe('upsertMany', () => {
    it('upserts each make keyed on makeId with unordered writes', async () => {
      const car = make(440);
      await repository.upsertMany([car]);

      expect(model.bulkWrite).toHaveBeenCalledTimes(1);
      expect(model.bulkWrite).toHaveBeenCalledWith(
        [{ replaceOne: { filter: { makeId: 440 }, replacement: car, upsert: true } }],
        { ordered: false },
      );
    });

    it('splits writes into batches of 1000', async () => {
      const makes = Array.from({ length: 1500 }, (_, i) => make(i));
      await repository.upsertMany(makes);

      expect(model.bulkWrite).toHaveBeenCalledTimes(2);
      expect(model.bulkWrite.mock.calls[0][0]).toHaveLength(1000);
      expect(model.bulkWrite.mock.calls[1][0]).toHaveLength(500);
    });

    it('does not write anything for an empty list', async () => {
      await repository.upsertMany([]);
      expect(model.bulkWrite).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('queries ordered by makeId with the given pagination', async () => {
      const lean = jest.fn().mockResolvedValue([make(440)]);
      const limit = jest.fn().mockReturnValue({ lean });
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });
      model.find.mockReturnValue({ sort });

      await expect(repository.findAll(10, 20)).resolves.toEqual([make(440)]);
      expect(sort).toHaveBeenCalledWith({ makeId: 1 });
      expect(skip).toHaveBeenCalledWith(20);
      expect(limit).toHaveBeenCalledWith(10);
    });
  });

  describe('findById', () => {
    it('finds a single make by makeId', async () => {
      const lean = jest.fn().mockResolvedValue(make(440));
      model.findOne.mockReturnValue({ lean });

      await expect(repository.findById(440)).resolves.toEqual(make(440));
      expect(model.findOne).toHaveBeenCalledWith({ makeId: 440 });
    });
  });

  it('counts stored makes', async () => {
    await expect(repository.count()).resolves.toBe(3);
  });
});
