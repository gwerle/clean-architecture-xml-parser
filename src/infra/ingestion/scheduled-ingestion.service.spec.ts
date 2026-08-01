import { IngestVehicleDataUseCase } from '../../domain/vehicles/application/use-cases/ingest-vehicle-data';
import { ScheduledIngestionService } from './scheduled-ingestion.service';

describe('ScheduledIngestionService', () => {
  let useCase: { execute: jest.Mock };

  const service = () =>
    new ScheduledIngestionService(useCase as unknown as IngestVehicleDataUseCase);

  beforeEach(() => {
    useCase = { execute: jest.fn().mockResolvedValue(undefined) };
  });

  it('ingests when the cron fires', async () => {
    await service().run();
    expect(useCase.execute).toHaveBeenCalled();
  });

  it('does not throw when ingestion fails', async () => {
    useCase.execute.mockRejectedValue(new Error('NHTSA is down'));
    await expect(service().run()).resolves.toBeUndefined();
  });
});
