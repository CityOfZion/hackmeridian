import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('service starts through a release symlink and drains on SIGTERM', { timeout: 10_000 }, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'vaultpass-startup-'));
  const entry = join(dir, 'server.mjs');
  symlinkSync(fileURLToPath(new URL('../src/server.mjs', import.meta.url)), entry);
  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      CHALLENGE_SECRET: 'startup test secret with at least thirty two bytes',
      P256_VERIFIER_ADDRESS: 'CA5ZJMYHPBW6ZSA5OYAJD3L54MHAN5PUKY5FVT7DXZIZ42YGTSDNRSQF',
      ALLOW_ACCOUNT_CREATION: 'false',
      ALLOW_TRANSFERS: 'false',
    },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  t.after(() => {
    child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  });
  const output = await Promise.race([
    once(child.stdout, 'data').then(([data]) => String(data)),
    once(child, 'exit').then(() => {
      throw new Error('Service exited before listening');
    }),
  ]);
  const endpoint = /listening on (127\.0\.0\.1:\d+)/.exec(output)?.[1];
  assert.ok(endpoint);
  const response = await fetch(`http://${endpoint}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
  const exit = once(child, 'exit');
  child.kill('SIGTERM');
  assert.deepEqual(await exit, [0, null]);
});
