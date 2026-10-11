import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

const MAX_STATE_BYTES = 10_000_000;

export function fileStore(directory) {
  const file = path.join(directory, 'state.json');
  return {
    async load() {
      try {
        const data = await readFile(file);
        if (data.length > MAX_STATE_BYTES) throw new Error('state-too-large');
        return JSON.parse(data.toString('utf8'));
      } catch (error) { if (error.code === 'ENOENT') return null; throw new Error('state-load-failed'); }
    },
    async save(state) {
      let handle; let temp;
      try {
        const serialized = JSON.stringify(state);
        if (Buffer.byteLength(serialized, 'utf8') > MAX_STATE_BYTES) throw new Error('state-too-large');
        await mkdir(directory, { recursive: true, mode: 0o700 });
        temp = path.join(directory, `.state-${randomUUID()}.tmp`);
        handle = await open(temp, 'wx', 0o600);
        await handle.writeFile(serialized, 'utf8');
        await handle.sync();
        await handle.close(); handle = null;
        await rename(temp, file);
        // Persist the directory entry on platforms supporting directory fsync.
        try { const dir = await open(directory, 'r'); try { await dir.sync(); } finally { await dir.close(); } } catch (error) { if (!['EISDIR', 'EPERM', 'EINVAL', 'ENOTSUP'].includes(error.code)) throw error; }
      } catch {
        await handle?.close().catch(() => {});
        if (temp) await unlink(temp).catch(() => {});
        throw new Error('state-save-failed');
      }
    },
  };
}
