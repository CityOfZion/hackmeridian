import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';

import { StrKey } from '@stellar/stellar-sdk';

import { accountAddress, issueChallenge, publicKeyBytes, verifyChallenge } from './account.mjs';
import { accountBalances, resolveAccount } from './stellar.mjs';
import { createTransferService } from './transfers.mjs';
import { TransferError } from './transfer-service.mjs';

const MAX_BODY = 4096;
const usedProofs = new Map();
const pending = new Map();
const recentRequests = new Map();

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function bodyJson(request) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) throw new TransferError('Request body too large', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new TransferError('Expected valid JSON');
  }
}

function limit(request, now = Date.now()) {
  const statusRead = request.url === '/transfers/status';
  const ip = `${request.socket.remoteAddress || 'unknown'}:${statusRead ? 'status' : 'write'}`;
  const values = (recentRequests.get(ip) || []).filter((time) => now - time < 60_000);
  if (values.length >= (statusRead ? 60 : 12)) return false;
  values.push(now);
  recentRequests.set(ip, values);
  return true;
}

function consumeProof(digest, token) {
  const id = `${digest}:${token}`;
  const now = Date.now();
  for (const [key, expires] of usedProofs) if (expires < now) usedProofs.delete(key);
  if (usedProofs.has(id)) return false;
  usedProofs.set(id, now + 120_000);
  return true;
}

async function handle(request, response, transfers) {
  if (!limit(request)) return json(response, 429, { error: 'Too many requests' });
  const path = new URL(request.url || '/', 'http://localhost').pathname;
  if (request.method === 'GET' && path === '/health') {
    return json(response, 200, {
      status: 'ok',
      network: 'mainnet',
      deploymentEnabled: process.env.ALLOW_ACCOUNT_CREATION === 'true',
      transfersEnabled: process.env.ALLOW_TRANSFERS === 'true',
    });
  }
  if (request.method !== 'POST') return json(response, 404, { error: 'Not found' });
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    return json(response, 415, { error: 'Expected application/json' });
  }
  const body = await bodyJson(request);
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return json(response, 400, { error: 'Expected an object' });
  if (path === '/transfers/prepare') return json(response, 200, await transfers().prepare(body.publicKey, body.intent));
  if (path === '/transfers/submit') return json(response, 200, await transfers().submit(body.id, body.signature));
  if (path === '/transfers/status') return json(response, 200, await transfers().status(body.id));
  if (path === '/challenge') {
    return json(response, 200, issueChallenge(process.env.CHALLENGE_SECRET));
  }
  if (path === '/accounts/balances') {
    const publicKey = publicKeyBytes(body.publicKey);
    const address = accountAddress(publicKey);
    return json(response, 200, await accountBalances(address, publicKey));
  }
  if (path === '/accounts/resolve') {
    const { digest, token, publicKey, signature } = body;
    if (!verifyChallenge(process.env.CHALLENGE_SECRET, digest, token, publicKey, signature)) {
      return json(response, 401, { error: 'Card proof was not valid or has expired' });
    }
    if (!consumeProof(digest, token)) return json(response, 409, { error: 'Card proof was already used' });
    const key = publicKeyBytes(publicKey);
    const id = accountAddress(key);
    if (!pending.has(id)) {
      pending.set(
        id,
        resolveAccount(key, { allowCreation: process.env.ALLOW_ACCOUNT_CREATION === 'true' }).finally(() =>
          pending.delete(id),
        ),
      );
    }
    const result = await pending.get(id);
    return json(response, 200, { ...result, ...(await accountBalances(result.address, key)) });
  }
  return json(response, 404, { error: 'Not found' });
}

export function makeServer({ transfers: suppliedTransfers } = {}) {
  let service = suppliedTransfers;
  const transfers = () => (service ??= createTransferService());
  const server = createServer((request, response) => {
    handle(request, response, transfers).catch((error) => {
      if (error instanceof TransferError) return json(response, error.status, { error: error.message });
      console.error('VaultPass backend request failed:', error instanceof Error ? error.message : String(error));
      if (!response.headersSent) json(response, 500, { error: 'VaultPass account service is unavailable' });
      else response.end();
    });
  });
  server.on('close', () => service?.close());
  return server;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  if (!process.env.CHALLENGE_SECRET || Buffer.byteLength(process.env.CHALLENGE_SECRET) < 32) {
    throw new Error('Set CHALLENGE_SECRET to at least 32 random bytes');
  }
  if (!StrKey.isValidContract(process.env.P256_VERIFIER_ADDRESS || '')) {
    throw new Error('Set P256_VERIFIER_ADDRESS to the deployed mainnet verifier contract');
  }
  if (
    (process.env.ALLOW_ACCOUNT_CREATION === 'true' || process.env.ALLOW_TRANSFERS === 'true') &&
    !process.env.CHANNELS_API_KEY
  ) {
    throw new Error('Set CHANNELS_API_KEY when account creation or transfers are enabled');
  }
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  makeServer().listen(port, host, () => console.log(`VaultPass account service listening on ${host}:${port}`));
}
