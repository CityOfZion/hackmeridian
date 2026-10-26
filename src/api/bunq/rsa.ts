import { createSign, generateKeyPair } from 'react-native-quick-crypto';

export type RsaKeyPair = { publicKeyPem: string; privateKeyPem: string };

/**
 * 2048-bit RSA key pair for the bunq installation, generated natively (OpenSSL via react-native-quick-crypto) off the
 * JS thread. Pure JS took from tens of seconds to minutes on Hermes.
 */
export function generateRsaKeyPair(): Promise<RsaKeyPair> {
  return new Promise((resolve, reject) => {
    generateKeyPair(
      'rsa',
      {
        modulusLength: 2048,
        publicExponent: 0x10001,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      },
      (error, publicKeyPem, privateKeyPem) => {
        if (error || typeof publicKeyPem !== 'string' || typeof privateKeyPem !== 'string') {
          reject(error ?? new Error('Could not generate the bunq key pair.'));
          return;
        }
        resolve({ publicKeyPem, privateKeyPem });
      },
    );
  });
}

/** `X-Bunq-Client-Signature`: RSA SHA-256 PKCS#1 v1.5 over the exact body bytes, base64-encoded. */
export function signBody(privateKeyPem: string, body: string) {
  return createSign('SHA256').update(body).sign(privateKeyPem).toString('base64');
}
