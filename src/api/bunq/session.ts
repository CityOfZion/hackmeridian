import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';

import { BunqError, bunqRequest, pick } from './client';
import { generateRsaKeyPair, signBody, type RsaKeyPair } from './rsa';

/**
 * bunq API context (spec "API context, once per backend instance"), done on the device for the sandbox demo:
 * RSA key pair → POST /installation → POST /device-server → signed POST /session-server. Everything is cached in
 * SecureStore, so the slow key generation and the device registration happen once per install.
 *
 * The API key comes from `EXPO_PUBLIC_BUNQ_API_KEY`; without one, a fresh sandbox user is created. Sandbox only: the
 * spec keeps bunq credentials on the COZ backend, never in the app.
 */

const STORE = {
  apiKey: 'bunq.apiKey',
  publicKey: 'bunq.publicKey',
  privateKey: 'bunq.privateKey',
  installation: 'bunq.installation',
  session: 'bunq.session',
} as const;

type Installation = { token: string; apiKey: string };
type BunqSession = { token: string; userId: number };

async function readJson<T>(key: string): Promise<T | undefined> {
  const value = await getItemAsync(key);
  return value ? (JSON.parse(value) as T) : undefined;
}

async function getApiKey() {
  const configured = process.env.EXPO_PUBLIC_BUNQ_API_KEY;
  if (configured) return configured;

  const stored = await getItemAsync(STORE.apiKey);
  if (stored) return stored;

  const response = await bunqRequest('POST', '/sandbox-user-person');
  const apiKey = pick<{ api_key: string }>(response, 'ApiKey')?.api_key;
  if (!apiKey) throw new Error('bunq did not return a sandbox API key.');
  await setItemAsync(STORE.apiKey, apiKey);
  return apiKey;
}

/** The installation's RSA key pair, generated once per install (a few seconds in JS). */
async function getKeyPair(): Promise<RsaKeyPair> {
  const [publicKeyPem, privateKeyPem] = await Promise.all([
    getItemAsync(STORE.publicKey),
    getItemAsync(STORE.privateKey),
  ]);
  if (publicKeyPem && privateKeyPem) return { publicKeyPem, privateKeyPem };

  const keyPair = await generateRsaKeyPair();
  await setItemAsync(STORE.publicKey, keyPair.publicKeyPem);
  await setItemAsync(STORE.privateKey, keyPair.privateKeyPem);
  // A new key needs a new installation
  await deleteItemAsync(STORE.installation);
  return keyPair;
}

/** POST /installation with our public key, then POST /device-server binding the API key. Once per key pair + API key. */
async function getInstallation(apiKey: string, keys: RsaKeyPair) {
  const stored = await readJson<Installation>(STORE.installation);
  if (stored?.apiKey === apiKey) return stored;

  const installed = await bunqRequest('POST', '/installation', { body: { client_public_key: keys.publicKeyPem } });
  const token = pick<{ token: string }>(installed, 'Token')?.token;
  if (!token) throw new Error('bunq did not return an installation token.');

  const device = { description: 'VaultPass', secret: apiKey };
  try {
    // A phone changes IP, so ask for any IP; keys that can't be wildcards fall back to the current IP
    await bunqRequest('POST', '/device-server', { body: { ...device, permitted_ips: ['*'] }, token });
  } catch {
    await bunqRequest('POST', '/device-server', { body: device, token });
  }

  const installation: Installation = { token, apiKey };
  await setItemAsync(STORE.installation, JSON.stringify(installation));
  return installation;
}

async function openSession(): Promise<BunqSession> {
  const cached = await readJson<BunqSession>(STORE.session);
  if (cached) return cached;

  const apiKey = await getApiKey();
  const keys = await getKeyPair();
  const installation = await getInstallation(apiKey, keys);

  const response = await bunqRequest('POST', '/session-server', {
    body: { secret: apiKey },
    token: installation.token,
    sign: (body) => signBody(keys.privateKeyPem, body),
  });
  const token = pick<{ token: string }>(response, 'Token')?.token;
  const user =
    pick<{ id: number }>(response, 'UserPerson') ??
    pick<{ id: number }>(response, 'UserCompany') ??
    pick<{ id: number }>(response, 'UserApiKey');
  if (!token || !user) throw new Error('bunq did not open a session.');

  const session: BunqSession = { token, userId: user.id };
  await setItemAsync(STORE.session, JSON.stringify(session));
  return session;
}

let pending: Promise<BunqSession> | undefined;

/** The current bunq session, opened on first use and shared by concurrent callers. */
function getSession() {
  pending ??= openSession().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}

/**
 * Runs an authenticated bunq call. An expired session (401) is reopened once; any other failure is thrown as is.
 */
export async function withBunqSession<T>(call: (session: BunqSession) => Promise<T>): Promise<T> {
  try {
    return await call(await getSession());
  } catch (error) {
    if (!(error instanceof BunqError) || error.status !== 401) throw error;
    pending = undefined;
    await deleteItemAsync(STORE.session);
    return call(await getSession());
  }
}
