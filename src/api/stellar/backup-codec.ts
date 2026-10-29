import { FREEZE_POLICY } from './freeze-codec.ts';
import { Address, StrKey, hash, xdr } from '@stellar/stellar-sdk/base';
import { p256 } from '@noble/curves/nist.js';
import {
  P256_VERIFIER,
  validatePreparedCall,
  type AccountBinding,
  type PreparedTransfer,
  type TransferState,
} from './transfer-codec.ts';

export type BackupIntent = { account: string; publicKey: string; protected?: true };
export type BackupRecord = {
  prepared: PreparedTransfer;
  intent: BackupIntent;
  state: TransferState;
  hash?: string;
  ledger?: number;
  message?: string;
};
export const backupKey = (key: string) => {
  if (!/^04[0-9a-f]{128}$/.test(key)) throw new Error('The backup must use a P-256 key.');
  const bytes = Uint8Array.from(key.match(/../g)!, (b) => parseInt(b, 16));
  p256.ProjectivePoint.fromHex(bytes);
  return bytes;
};
export function validateBackupIntent(input: BackupIntent): BackupIntent {
  if (!input || !StrKey.isValidContract(input.account)) throw new Error('Choose a smart account to back up.');
  backupKey(input.publicKey);
  if (input.protected !== undefined && input.protected !== true) throw new Error('Invalid backup protection.');
  return { account: input.account, publicKey: input.publicKey, ...(input.protected ? { protected: true } : {}) };
}
/** A domain-separated, account-bound proof of possession; it cannot authorize a transaction. */
export function backupProofDigest(account: string, challenge: Uint8Array): Uint8Array {
  if (!StrKey.isValidContract(account)) throw new Error('Invalid backup account.');
  if (challenge.length !== 32) throw new Error('Invalid backup challenge.');
  return hash(
    new Uint8Array([...new TextEncoder().encode('VaultPass backup possession v1\0' + account), ...challenge]),
  );
}
export function backupFunction(intent: BackupIntent): string {
  validateBackupIntent(intent);
  return xdr.HostFunction.hostFunctionTypeInvokeContract(
    new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(intent.account).toScAddress(),
      functionName: 'add_context_rule',
      args: [
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Default')]),
        xdr.ScVal.scvString('Backup card'),
        xdr.ScVal.scvVoid(),
        xdr.ScVal.scvVec([
          xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol('External'),
            Address.fromString(P256_VERIFIER).toScVal(),
            xdr.ScVal.scvBytes(backupKey(intent.publicKey)),
          ]),
        ]),
        xdr.ScVal.scvMap(
          intent.protected
            ? [new xdr.ScMapEntry({ key: Address.fromString(FREEZE_POLICY).toScVal(), val: xdr.ScVal.scvVoid() })]
            : [],
        ),
      ],
    }),
  ).toXdr('base64');
}
export function validatePreparedBackup(
  prepared: PreparedTransfer,
  intent: BackupIntent,
  key: Uint8Array,
  ledger: number,
  binding: AccountBinding,
) {
  if (binding.account !== intent.account) throw new Error('The backup belongs to a different account.');
  if (Array.from(key, (b) => b.toString(16).padStart(2, '0')).join('') === intent.publicKey)
    throw new Error('Use a different card key for your backup.');
  validatePreparedCall(prepared, backupFunction(intent), key, ledger, binding);
}
