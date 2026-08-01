import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { MakeSummary, VehicleType } from '../../domain/vehicles/enterprise/entities/vehicle-make';

export class TransformationError extends Error {}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  isArray: (tagName) => tagName === 'AllVehicleMakes' || tagName === 'VehicleTypesForMakeIds',
});

/**
 * Returns the `entriesKey` records under `Response.Results`. An empty `Results`
 * is a valid empty answer; a populated one missing `entriesKey` means the
 * upstream contract changed and must not be mistaken for "no data".
 */
function parseResults(xml: string, entriesKey: string): Record<string, unknown>[] {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new TransformationError(`Invalid XML: ${validation.err.msg}`);
  }
  const doc: unknown = parser.parse(xml);
  const response = (doc as { Response?: unknown }).Response;
  if (!response || typeof response !== 'object' || !('Results' in response)) {
    throw new TransformationError('Unexpected XML shape: missing Response.Results');
  }
  const results = (response as { Results: unknown }).Results;
  if (!results || typeof results !== 'object') {
    return [];
  }
  const entries = (results as Record<string, unknown>)[entriesKey];
  if (entries === undefined) {
    throw new TransformationError(`Unexpected XML shape: Results contains no ${entriesKey}`);
  }
  return Array.isArray(entries) ? (entries as Record<string, unknown>[]) : [];
}

function toInt(value: unknown, field: string): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isInteger(n)) {
    throw new TransformationError(`Expected integer for ${field}, got: ${String(value)}`);
  }
  return n;
}

function toText(value: unknown, field: string): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) {
    throw new TransformationError(`Expected non-empty string for ${field}, got: ${String(value)}`);
  }
  return s;
}

export function parseAllMakesXml(xml: string): MakeSummary[] {
  return parseResults(xml, 'AllVehicleMakes').map((record) => ({
    makeId: toInt(record.Make_ID, 'Make_ID'),
    makeName: toText(record.Make_Name, 'Make_Name'),
  }));
}

export function parseVehicleTypesXml(xml: string): VehicleType[] {
  return parseResults(xml, 'VehicleTypesForMakeIds').map((record) => ({
    typeId: toInt(record.VehicleTypeId, 'VehicleTypeId'),
    typeName: toText(record.VehicleTypeName, 'VehicleTypeName'),
  }));
}
