import { Buffer } from 'node:buffer';
import { p256 } from '@noble/curves/nist.js';
import { Address, xdr } from '@stellar/stellar-sdk/base';
import {
  ACCOUNT_DEPLOYER,
  P256_VERIFIER,
  TRANSFER_NETWORK,
  cardAccountAddress,
  transferFunction,
  transferDigest,
  signedTransferAuth,
} from '../src/api/stellar/transfer-codec.ts';

export const privateKey = new Uint8Array(32).fill(7);
export const publicKey = p256.getPublicKey(privateKey, false);
export const publicKeyHex = Buffer.from(publicKey).toString('hex');
export const intent = { asset: 'XLM', recipient: ACCOUNT_DEPLOYER, amount: '1.25' };
export function fixture(v2 = false) {
  const account = cardAccountAddress(publicKey);
  const func = transferFunction(account, intent);
  const args = xdr.HostFunction.fromXdr(func, 'base64').invokeContract;
  const c = new xdr.SorobanAddressCredentials({
    address: Address.fromString(account).toScAddress(),
    nonce: 456n,
    signatureExpirationLedger: 1120,
    signature: xdr.ScVal.scvVoid(),
  });
  const auth = new xdr.SorobanAuthorizationEntry({
    credentials: v2
      ? xdr.SorobanCredentials.sorobanCredentialsAddressV2(c)
      : xdr.SorobanCredentials.sorobanCredentialsAddress(c),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(args),
      subInvocations: [],
    }),
  }).toXdr('base64');
  const prepared = {
    id: '00000000-0000-4000-8000-000000000001',
    account,
    func,
    auth,
    network: TRANSFER_NETWORK,
    verifier: P256_VERIFIER,
    latestLedger: 1000,
    expirationLedger: 1120,
  };
  const signature = p256.sign(transferDigest(prepared), privateKey, { lowS: true, prehash: false }).toCompactRawBytes();
  return { prepared, signature, signedAuth: signedTransferAuth(prepared, publicKey, signature) };
}
