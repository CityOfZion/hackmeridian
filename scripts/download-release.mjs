import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { releaseVersion } from './release-version.mjs';

const { version, versionCode } = releaseVersion(process.env.GITHUB_REF_NAME);
const builds = JSON.parse(await readFile('eas-build.json', 'utf8'));
if (!Array.isArray(builds) || builds.length !== 1) throw new Error('Expected exactly one Android build');
const build = builds[0];
if (
  build.status !== 'FINISHED' ||
  build.platform !== 'ANDROID' ||
  build.appVersion !== version ||
  String(build.appBuildVersion) !== String(versionCode) ||
  build.gitCommitHash !== process.env.GITHUB_SHA
)
  throw new Error('EAS build identity or version does not match this tag');
const url = new URL(build.artifacts?.buildUrl);
if (url.protocol !== 'https:') throw new Error('Expected an HTTPS artifact URL');
const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
if (!response.ok) throw new Error(`Artifact download failed (${response.status})`);
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length < 1000 || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
  throw new Error('EAS artifact is not an APK archive');
await mkdir('release', { recursive: true });
const name = `VaultPass-v${version}-android.apk`;
await writeFile(`release/${name}`, bytes);
await writeFile('release/SHA256SUMS.txt', `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`);
await writeFile(
  'release/build-info.json',
  JSON.stringify(
    {
      tag: process.env.GITHUB_REF_NAME,
      commit: build.gitCommitHash,
      version,
      versionCode,
      easBuildId: build.id,
      platform: 'android',
    },
    null,
    2,
  ),
);
