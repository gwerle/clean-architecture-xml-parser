import { chunk } from './chunk';

describe('chunk', () => {
  it('splits items into batches with a remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns an empty array for no items', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it('throws on a non-positive size', () => {
    expect(() => chunk([1], 0)).toThrow('chunk size must be >= 1');
  });
});
