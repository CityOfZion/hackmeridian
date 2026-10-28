import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function releaseVersion(tag) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))
    throw new Error('Release tags must be exactly vX.X.X (no suffix or leading zero).');
  const version = tag.slice(1);
  const [major, minor, patch] = version.split('.').map(Number);
  if (major > 2099 || minor > 999 || patch > 999)
    throw new Error('Version exceeds Android versionCode limits (major <= 2099, minor/patch <= 999).');
  return { version, versionCode: major * 1_000_000 + minor * 1_000 + patch + 1 };
}
export function releaseApiUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.hostname.includes('.') ||
    /(^localhost$|\.localhost$|\.local$|\.invalid$|\.example$|^example\.)/.test(url.hostname) ||
    /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) ||
    url.hostname.includes(':')
  )
    throw new Error('Set VAULTPASS_API_URL to the public HTTPS backend URL.');
  return url.href.replace(/\/$/, '');
}
export function prepareRelease(tag, apiUrl, root = new URL('../', import.meta.url)) {
  const { version, versionCode } = releaseVersion(tag);
  const url = releaseApiUrl(apiUrl);
  const edit = (name, fn) => {
    const path = new URL(name, root);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    fn(json);
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  };
  edit('app.json', (data) => {
    data.expo.version = version;
    data.expo.android.versionCode = versionCode;
  });
  edit('package.json', (data) => {
    data.version = version;
  });
  edit('eas.json', (data) => {
    data.build.release.env = { ...data.build.release.env, EXPO_PUBLIC_VAULTPASS_API_URL: url };
  });
  return { version, versionCode };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.log(prepareRelease(process.env.GITHUB_REF_NAME, process.env.VAULTPASS_API_URL));
}
