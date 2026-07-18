import 'fake-indexeddb/auto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { buildMaid, type BuiltMaid } from '@beam/maid/app';
import type { MaidConfig } from '@beam/maid/config';
import { ParkSession } from './parkSession.js';
import { RecoverSession } from './recoverSession.js';
import type { CompletedFile } from '../transfer/types.js';

const openApps: BuiltMaid[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((built) => built.close()));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function makeFile(name: string, size: number): File {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 17 + 5) % 256;
  return new File([bytes], name, { type: 'application/octet-stream' });
}

async function startMaid(): Promise<{ built: BuiltMaid; url: string; dataDir: string }> {
  const dataDir = await mkdtemp(join(tmpdir(), 'drop-maid-client-'));
  tempDirs.push(dataDir);
  const config: MaidConfig = {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    accessToken: 'client-test-access-key-24-characters',
    corsOrigins: [],
    maxParkBytes: 20 * 1024 * 1024,
    minFreeBytes: 1,
    defaultTtlSeconds: 3600,
    maxTtlSeconds: 7200,
  };
  const built = await buildMaid({ config });
  openApps.push(built);
  await built.app.listen({ host: '127.0.0.1', port: 0 });
  const address = built.app.server.address() as AddressInfo;
  return { built, url: `http://127.0.0.1:${address.port}`, dataDir };
}

describe('blind maid client round trip', () => {
  it('parks ciphertext without the key and recovers byte-identical files', async () => {
    const { url, dataDir } = await startMaid();
    const original = makeFile('parked.bin', 4 * 1024 * 1024 + 19);
    let recoveryUrl = '';

    await new Promise<void>((resolve, reject) => {
      const session = new ParkSession(url, 'https://drop.test', {
        onComplete: (createdUrl) => {
          recoveryUrl = createdUrl;
          resolve();
        },
        onError: reject,
      });
      void session
        .start([original], 'client-test-access-key-24-characters', 3600)
        .catch(reject);
    });

    const parsed = new URL(recoveryUrl);
    const parkId = parsed.pathname.split('/').at(-1)!;
    const fragment = parsed.hash.slice(1);
    const keyFragment = fragment.split('.')[0]!;
    const metadata = await readFile(join(dataDir, 'parks', parkId, 'park.json'), 'utf8');
    expect(metadata).not.toContain(keyFragment);

    let recovered: CompletedFile[] = [];
    await new Promise<void>((resolve, reject) => {
      const session = new RecoverSession(url, parkId, fragment, {
        onComplete: (files) => {
          recovered = files;
          resolve();
        },
        onError: reject,
      });
      void session.start().catch(reject);
    });

    expect(recovered).toHaveLength(1);
    const got = await recovered[0]!.getBytes();
    const want = new Uint8Array(await original.arrayBuffer());
    expect(got).toEqual(want);
  });
});
