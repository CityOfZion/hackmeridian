import { p256 } from '@noble/curves/nist.js';
import { Address, xdr } from '@stellar/stellar-sdk/base';
import { fixture, privateKey, publicKey } from './transfer-fixture.mjs';
import { backupFunction } from '../src/api/stellar/backup-codec.ts';
import { transferDigest, signedTransferAuth } from '../src/api/stellar/transfer-codec.ts';
export const backupSecret = new Uint8Array(32).fill(8);
export const backupPublicKey = p256.getPublicKey(backupSecret, false);
export const backupPublicKeyHex = Buffer.from(backupPublicKey).toString('hex');
export function backupFixture() {
  const base = fixture().prepared;
  const intent = { account: base.account, publicKey: backupPublicKeyHex };
  const prepared = authorization({ ...base, func: backupFunction(intent), ruleId: 0 }, 457n);
  const signature = p256.sign(transferDigest(prepared), privateKey, { lowS: true }).toCompactRawBytes();
  const binding = { account: prepared.account, ruleId: 0 };
  return {
    prepared,
    intent,
    binding,
    signature,
    signedAuth: signedTransferAuth(prepared, publicKey, signature, binding),
  };
}
export function authorization(prepared, nonce) {
  const c = new xdr.SorobanAddressCredentials({
    address: Address.fromString(prepared.account).toScAddress(),
    nonce,
    signatureExpirationLedger: prepared.expirationLedger,
    signature: xdr.ScVal.scvVoid(),
  });
  return {
    ...prepared,
    auth: new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(c),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
          xdr.HostFunction.fromXdr(prepared.func, 'base64').invokeContract,
        ),
        subInvocations: [],
      }),
    }).toXdr('base64'),
  };
}
