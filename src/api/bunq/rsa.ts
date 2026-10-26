import { getRandomBytes } from 'expo-crypto';
import forge from 'node-forge';

/** forge's own PRNG has no platform entropy source on Hermes, so feed it the OS CSPRNG. */
const prng = { getBytesSync: (count: number) => forge.util.binary.raw.encode(getRandomBytes(count)) };

export type RsaKeyPair = { publicKeyPem: string; privateKeyPem: string };

/** 2048-bit RSA key pair for the bunq installation. With a callback, forge searches primes in short steps, so the
 * JS thread stays responsive. */
export function generateRsaKeyPair(): Promise<RsaKeyPair> {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001, prng }, (error, keyPair) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({
        publicKeyPem: forge.pki.publicKeyToPem(keyPair.publicKey),
        privateKeyPem: forge.pki.privateKeyToPem(keyPair.privateKey),
      });
    });
  });
}

/** `X-Bunq-Client-Signature`: RSA SHA-256 PKCS#1 v1.5 over the exact body bytes, base64-encoded. */
export function signBody(privateKeyPem: string, body: string) {
  const digest = forge.md.sha256.create();
  digest.update(body, 'utf8');
  return forge.util.encode64(forge.pki.privateKeyFromPem(privateKeyPem).sign(digest));
}
