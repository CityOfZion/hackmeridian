import { Buffer } from 'node:buffer';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { p256 } from '@noble/curves/nist.js';
import { Address, Keypair, Networks, StrKey, hash, xdr } from '@stellar/stellar-sdk';

export const NETWORK_PASSPHRASE = Networks.PUBLIC;
export const ACCOUNT_WASM_HASH = 'c514d35ea67eaea9bfc1fb3327854c0c06111bc1ddebd4fe217c504c1004b9e1';
export const DEPLOYER = Keypair.fromRawEd25519Seed(hash(Buffer.from('openzeppelin-smart-account-kit')));
const DOMAIN = Buffer.from('VaultPass ITEM P-256 account v1\0');
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

export function publicKeyBytes(value) {
  if (typeof value !== 'string' || !/^04[0-9a-fA-F]{128}$/.test(value)) {
    throw new Error('Expected a 65-byte uncompressed P-256 public key');
  }
  const bytes = Buffer.from(value, 'hex');
  p256.ProjectivePoint.fromHex(bytes);
  return bytes;
}

export function signatureBytes(value) {
  if (typeof value !== 'string' || !/^[0-9a-fA-F]{128}$/.test(value)) {
    throw new Error('Expected a 64-byte P-256 signature');
  }
  return Buffer.from(value, 'hex');
}

export function accountSalt(publicKey) {
  return hash(Buffer.concat([DOMAIN, publicKey]));
}

export function contractAddress(salt) {
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: hash(Buffer.from(NETWORK_PASSPHRASE)),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: Address.fromString(DEPLOYER.publicKey()).toScAddress(),
          salt,
        }),
      ),
    }),
  );
  return StrKey.encodeContract(hash(preimage.toXDR()));
}

export function accountAddress(publicKey) {
  return contractAddress(accountSalt(publicKey));
}

function challengeMac(secret, challenge, expires) {
  return createHmac('sha256', secret).update(challenge).update(':').update(String(expires)).digest();
}

export function issueChallenge(secret, now = Date.now()) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('CHALLENGE_SECRET must be at least 32 bytes');
  const challenge = randomBytes(32);
  const expires = now + CHALLENGE_TTL_MS;
  const mac = challengeMac(secret, challenge, expires);
  return { digest: challenge.toString('hex'), token: `${expires}.${mac.toString('hex')}` };
}

export function verifyChallenge(secret, digestHex, token, publicKeyHex, signatureHex, now = Date.now()) {
  if (typeof digestHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(digestHex)) return false;
  const match = typeof token === 'string' && /^(\d{13})\.([0-9a-fA-F]{64})$/.exec(token);
  if (!match) return false;
  const expires = Number(match[1]);
  if (!Number.isSafeInteger(expires) || expires < now || expires > now + CHALLENGE_TTL_MS) return false;
  const digest = Buffer.from(digestHex, 'hex');
  const expected = challengeMac(secret, digest, expires);
  const supplied = Buffer.from(match[2], 'hex');
  if (!timingSafeEqual(expected, supplied)) return false;
  try {
    const publicKey = publicKeyBytes(publicKeyHex);
    const signature = signatureBytes(signatureHex);
    return p256.verify(signature, digest, publicKey, { lowS: false });
  } catch {
    return false;
  }
}
