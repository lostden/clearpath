import { beforeEach, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readAlertCache, writeAlertCache } from '../src/data/alertCache';
import type { AlertSnapshot } from '../src/domain/types';
import { officialAlert, TEST_NOW } from './fixtures/alerts';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

const getItem = jest.mocked(AsyncStorage.getItem);
const setItem = jest.mocked(AsyncStorage.setItem);
const point = { latitude: 30, longitude: -99 };
const snapshot = (): AlertSnapshot => ({ source: 'live', alerts: [officialAlert()],
  fetchedAt: new Date(TEST_NOW).toISOString(), locationKey: '30,-99' });

beforeEach(() => { jest.resetAllMocks(); });

test('successful snapshots read as cached and retain their original retrieval timestamp', async () => {
  await writeAlertCache(snapshot());
  const [key, value] = setItem.mock.calls[0];
  expect(key).toBe('@clearpath/alerts/v1/latest');
  getItem.mockResolvedValue(value);
  expect(await readAlertCache(point)).toEqual({ ...snapshot(), source: 'cached' });
});

test('a valid zero-alert snapshot is still cached information', async () => {
  const empty = { ...snapshot(), alerts: [] };
  getItem.mockResolvedValue(JSON.stringify({ version: 1, snapshot: empty }));
  expect(await readAlertCache(point)).toEqual({ ...empty, source: 'cached' });
});

test('rejects corrupt, unversioned, wrong-point, and simulated cache contents', async () => {
  for (const raw of ['not json', JSON.stringify(snapshot()),
    JSON.stringify({ version: 2, snapshot: snapshot() }),
    JSON.stringify({ version: 1, snapshot: { ...snapshot(), source: 'demo' } }),
    JSON.stringify({ version: 1, snapshot: { ...snapshot(), locationKey: '31,-99' } }),
    JSON.stringify({ version: 1, snapshot: { ...snapshot(), alerts: [{}] } }),
  ]) {
    getItem.mockResolvedValue(raw);
    expect(await readAlertCache(point)).toBeNull();
  }
});

test('storage failures do not manufacture an empty successful snapshot', async () => {
  getItem.mockRejectedValue(new Error('storage unavailable'));
  expect(await readAlertCache(point)).toBeNull();
});

test('does not write simulated or cached data into the real-alert cache', async () => {
  await expect(writeAlertCache({ ...snapshot(), source: 'demo' })).rejects.toThrow(TypeError);
  await expect(writeAlertCache({ ...snapshot(), source: 'cached' })).rejects.toThrow(TypeError);
  await expect(writeAlertCache({ ...snapshot(), locationKey: '30,190' })).rejects.toThrow(TypeError);
  expect(setItem).not.toHaveBeenCalled();
});
