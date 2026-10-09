import { coordinatesFor, locationKey, validCoordinates } from '../src/domain/alerts';

describe('location input validation', () => {
  test.each([
    null, undefined, {}, { latitude: '30', longitude: -99 },
    { latitude: NaN, longitude: -99 }, { latitude: 30, longitude: Infinity },
    { latitude: 90.1, longitude: 0 }, { latitude: 0, longitude: -180.1 },
  ])('rejects invalid coordinate input %#', (point) => {
    expect(validCoordinates(point)).toBe(false);
  });

  test('accepts geographic boundary values', () => {
    expect(validCoordinates({ latitude: -90, longitude: 180 })).toBe(true);
    expect(validCoordinates({ latitude: 90, longitude: -180 })).toBe(true);
  });

  test('uses the manual location coordinates rather than its display name', () => {
    const point = { latitude: 30.0474, longitude: -99.1403 };
    expect(coordinatesFor({ label: 'Selected point', coordinates: point, kind: 'manual' })).toEqual(point);
    expect(locationKey(point)).toBe('30.0474,-99.1403');
  });

  test('keeps nearby selected points distinct for alert cache isolation', () => {
    expect(locationKey({ latitude: 30.04741, longitude: -99.1403 }))
      .not.toBe(locationKey({ latitude: 30.04749, longitude: -99.1403 }));
  });

  test('invalid coordinates cannot produce a network/cache location key', () => {
    expect(() => locationKey({ latitude: 300, longitude: -99 })).toThrow(RangeError);
  });
});
