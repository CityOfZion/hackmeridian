import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareRelease, releaseApiUrl, releaseVersion } from '../scripts/release-version.mjs';

test('only exact stable semver tags fit Android versionCode', () => {
  assert.deepEqual(releaseVersion('v2.1.0'), { version: '2.1.0', versionCode: 2001001 });
  for (const bad of ['2.1.0', 'v01.2.3', 'v1.2', 'v1.2.3-beta', 'v1.2.3+meta', 'v1.1000.0', 'v2100.0.0', 'v1.2.3\n'])
    assert.throws(() => releaseVersion(bad));
  assert.ok(releaseVersion('v3.0.0').versionCode > releaseVersion('v2.999.999').versionCode);
});
test('release backend must be public HTTPS without credentials or query secrets', () => {
  assert.equal(releaseApiUrl('https://api.vaultpass.test/v1/'), 'https://api.vaultpass.test/v1');
  for (const bad of [
    '',
    'http://api.example.org',
    'https://localhost',
    'https://127.0.0.1',
    'https://10.0.0.1',
    'https://[::1]',
    'https://ci.invalid',
    'https://example.com',
    'https://user:password@api.test',
    'https://api.test?token=secret',
  ])
    assert.throws(() => releaseApiUrl(bad));
});
test('tag preparation synchronizes Expo, package, Android version and EAS build URL', () => {
  const root = mkdtempSync(join(tmpdir(), 'vaultpass-release-test-'));
  try {
    writeFileSync(join(root, 'app.json'), JSON.stringify({ expo: { android: {}, name: 'VaultPass' } }));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'vaultpass' }));
    writeFileSync(
      join(root, 'eas.json'),
      JSON.stringify({ build: { release: { android: { credentialsSource: 'remote' } } } }),
    );
    prepareRelease('v2.1.3', 'https://wallet.example.org', pathToFileURL(root + '/'));
    assert.equal(JSON.parse(readFileSync(join(root, 'app.json'))).expo.android.versionCode, 2001004);
    assert.equal(JSON.parse(readFileSync(join(root, 'package.json'))).version, '2.1.3');
    const release = JSON.parse(readFileSync(join(root, 'eas.json'))).build.release;
    assert.equal(release.env.EXPO_PUBLIC_VAULTPASS_API_URL, 'https://wallet.example.org');
    assert.equal(release.android.credentialsSource, 'remote');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
