import { ConfigService } from '@nestjs/config';
import { NhtsaClient } from './nhtsa.client';

const makesXml = `<Response><Results><AllVehicleMakes><Make_ID>440</Make_ID><Make_Name>ASTON MARTIN</Make_Name></AllVehicleMakes></Results></Response>`;
const typesXml = `<Response><Results><VehicleTypesForMakeIds><VehicleTypeId>2</VehicleTypeId><VehicleTypeName>Passenger Car</VehicleTypeName></VehicleTypesForMakeIds></Results></Response>`;

const configStub = {
  get: (key: string, defaultValue?: unknown) =>
    ({
      NHTSA_API_BASE_URL: 'https://nhtsa.test/api/vehicles',
      NHTSA_TIMEOUT_MS: 1000,
      NHTSA_MAX_RETRIES: 2,
      NHTSA_RETRY_DELAY_MS: 1,
    })[key] ?? defaultValue,
} as ConfigService;

describe('NhtsaClient', () => {
  let client: NhtsaClient;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    client = new NhtsaClient(configStub);
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('fetches and parses all makes', async () => {
    fetchMock.mockResolvedValue(new Response(makesXml));
    await expect(client.getAllMakes()).resolves.toEqual([
      { makeId: 440, makeName: 'ASTON MARTIN' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://nhtsa.test/api/vehicles/getallmakes?format=xml',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('fetches and parses vehicle types for a make', async () => {
    fetchMock.mockResolvedValue(new Response(typesXml));
    await expect(client.getVehicleTypesForMake(440)).resolves.toEqual([
      { typeId: 2, typeName: 'Passenger Car' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://nhtsa.test/api/vehicles/GetVehicleTypesForMakeId/440?format=xml',
      expect.anything(),
    );
  });

  it('retries on network errors and succeeds', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response(makesXml));
    await expect(client.getAllMakes()).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx responses', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('error', { status: 503 }))
      .mockResolvedValueOnce(new Response(makesXml));
    await expect(client.getAllMakes()).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable responses', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 404 }));
    await expect(client.getVehicleTypesForMake(9999)).rejects.toThrow('NHTSA request failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not leak the upstream URL in the thrown error', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(client.getAllMakes()).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('nhtsa.test') }),
    );
  });

  it('throws after exhausting retries', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(client.getAllMakes()).rejects.toThrow('NHTSA request failed');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
