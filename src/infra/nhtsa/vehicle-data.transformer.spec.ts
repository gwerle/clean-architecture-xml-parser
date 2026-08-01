import {
  parseAllMakesXml,
  parseVehicleTypesXml,
  TransformationError,
} from './vehicle-data.transformer';

const makesXml = `<Response>
  <Count>2</Count>
  <Message>Response returned successfully</Message>
  <Results>
    <AllVehicleMakes><Make_ID>440</Make_ID><Make_Name>ASTON MARTIN</Make_Name></AllVehicleMakes>
    <AllVehicleMakes><Make_ID>441</Make_ID><Make_Name>TESLA</Make_Name></AllVehicleMakes>
  </Results>
</Response>`;

const vehicleTypesXml = `<Response>
  <Count>2</Count>
  <Message>Response returned successfully</Message>
  <SearchCriteria>Make ID: 440</SearchCriteria>
  <Results>
    <VehicleTypesForMakeIds><VehicleTypeId>2</VehicleTypeId><VehicleTypeName>Passenger Car</VehicleTypeName></VehicleTypesForMakeIds>
    <VehicleTypesForMakeIds><VehicleTypeId>7</VehicleTypeId><VehicleTypeName>Multipurpose Passenger Vehicle (MPV)</VehicleTypeName></VehicleTypesForMakeIds>
  </Results>
</Response>`;

describe('parseAllMakesXml', () => {
  it('transforms makes XML into the unified JSON shape', () => {
    expect(parseAllMakesXml(makesXml)).toEqual([
      { makeId: 440, makeName: 'ASTON MARTIN' },
      { makeId: 441, makeName: 'TESLA' },
    ]);
  });

  it('returns an array when the XML contains a single make', () => {
    const xml = `<Response><Results><AllVehicleMakes><Make_ID>440</Make_ID><Make_Name>ASTON MARTIN</Make_Name></AllVehicleMakes></Results></Response>`;
    expect(parseAllMakesXml(xml)).toEqual([{ makeId: 440, makeName: 'ASTON MARTIN' }]);
  });

  it('keeps numeric-looking make names as strings', () => {
    const xml = `<Response><Results><AllVehicleMakes><Make_ID>1</Make_ID><Make_Name>1955</Make_Name></AllVehicleMakes></Results></Response>`;
    expect(parseAllMakesXml(xml)).toEqual([{ makeId: 1, makeName: '1955' }]);
  });

  it('returns an empty array when Results is empty', () => {
    expect(parseAllMakesXml('<Response><Results /></Response>')).toEqual([]);
  });

  it('throws TransformationError on malformed XML', () => {
    expect(() => parseAllMakesXml('<Response><Results>')).toThrow(TransformationError);
  });

  it('throws TransformationError when Response.Results is missing', () => {
    expect(() => parseAllMakesXml('<Other>data</Other>')).toThrow(TransformationError);
  });

  it('throws instead of reporting zero makes when the upstream tag changes', () => {
    const xml = `<Response><Results><VehicleMakes><Make_ID>440</Make_ID><Make_Name>ASTON MARTIN</Make_Name></VehicleMakes></Results></Response>`;
    expect(() => parseAllMakesXml(xml)).toThrow(TransformationError);
  });

  it('throws TransformationError on a non-numeric make id', () => {
    const xml = `<Response><Results><AllVehicleMakes><Make_ID>abc</Make_ID><Make_Name>X</Make_Name></AllVehicleMakes></Results></Response>`;
    expect(() => parseAllMakesXml(xml)).toThrow(TransformationError);
  });

  it('throws TransformationError on an empty make name', () => {
    const xml = `<Response><Results><AllVehicleMakes><Make_ID>1</Make_ID><Make_Name></Make_Name></AllVehicleMakes></Results></Response>`;
    expect(() => parseAllMakesXml(xml)).toThrow(TransformationError);
  });
});

describe('parseVehicleTypesXml', () => {
  it('transforms vehicle types XML into the unified JSON shape', () => {
    expect(parseVehicleTypesXml(vehicleTypesXml)).toEqual([
      { typeId: 2, typeName: 'Passenger Car' },
      { typeId: 7, typeName: 'Multipurpose Passenger Vehicle (MPV)' },
    ]);
  });

  it('returns an empty array for a make without vehicle types', () => {
    expect(parseVehicleTypesXml('<Response><Results /></Response>')).toEqual([]);
  });

  it('returns an array when the XML contains a single vehicle type', () => {
    const xml = `<Response><Results><VehicleTypesForMakeIds><VehicleTypeId>2</VehicleTypeId><VehicleTypeName>Passenger Car</VehicleTypeName></VehicleTypesForMakeIds></Results></Response>`;
    expect(parseVehicleTypesXml(xml)).toEqual([{ typeId: 2, typeName: 'Passenger Car' }]);
  });
});
