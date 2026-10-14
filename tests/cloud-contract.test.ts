import { execFileSync } from "node:child_process";
import path from "node:path";
import { readServerStatus } from "../src/services/cloudPush.validation";

// Run the actual ESM watcher in Node, keeping real provider I/O mocked below
// its boundary. A hand-written mobile status fixture hid this contract bug.
test("mobile status validation accepts the actual watcher response after a successful baseline", () => {
  const script = `
    import { Watcher } from './server/watcher.mjs';
    const now = Date.parse('2026-10-13T12:00:00Z');
    const watcher = new Watcher({
      now: () => now,
      store: { load: async () => null, save: async () => {} },
      transport: {
        getWarnings: async () => ({ type: 'FeatureCollection', features: [] }),
        send: async () => { throw new Error('A baseline must not send'); },
        receipts: async () => ({ data: {} }),
      },
    });
    await watcher.initialize();
    const device = await watcher.enroll({
      expoPushToken: 'ExpoPushToken[contract-test-fixture]',
      point: { latitude: 30, longitude: -99 },
      locationObservedAt: new Date(now).toISOString(),
    });
    await watcher.tick();
    console.log(JSON.stringify(watcher.status(device.deviceId, device.bearerToken)));
  `;
  const actual: unknown = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 10_000,
  }));
  expect(readServerStatus(actual)).toMatchObject({
    baseline: "ready", lastCheckAt: "2026-10-13T12:00:00.000Z", pendingReceipts: 0,
  });
});

test.each([0, "not-a-date", "2026-02-30T12:00:00Z", "2026-10-13T12:00:00"])(
  "cloud status rejects malformed last-check timestamps (%s)", (lastCheckAt) => {
    expect(() => readServerStatus({
      enabled: true, baseline: "ready", locationFresh: true,
      locationObservedAt: "2026-10-13T12:00:00Z", lastCheckAt,
      lastError: null, lastDelivery: null, pendingReceipts: 0,
    })).toThrow();
  },
);
