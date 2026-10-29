import { Address, StrKey, xdr } from '@stellar/stellar-sdk/base';
import {
  validatePreparedCall,
  type AccountBinding,
  type PreparedTransfer,
  type TransferState,
} from './transfer-codec.ts';
/** Deterministic address, pinned in the app; backend cannot substitute a policy. */
export const FREEZE_POLICY = 'CAPTKW6GZ7USCDVQMDN6IX3X3AV5WDSJWXSXEXA2QVHVDOCBVHY5EULU';
export type FreezeIntent = { account: string; action: 'install' | 'freeze' | 'unfreeze'; ruleId?: number };
export type FreezeRecord = {
  prepared: PreparedTransfer;
  intent: FreezeIntent;
  state: TransferState;
  hash?: string;
  message?: string;
};
export type FreezeStatus = { enabled: boolean; covered: number[]; rules: number[]; frozen: boolean | null };
export function validateFreezeIntent(value: FreezeIntent): FreezeIntent {
  if (!value || !StrKey.isValidContract(value.account) || !['install', 'freeze', 'unfreeze'].includes(value.action))
    throw new Error('Invalid account protection request.');
  if (value.action === 'install') {
    if (!Number.isInteger(value.ruleId) || value.ruleId! < 0 || value.ruleId! > 14)
      throw new Error('Invalid card rule.');
    return { account: value.account, action: value.action, ruleId: value.ruleId };
  }
  if (value.ruleId !== undefined) throw new Error('Unexpected card rule.');
  return { account: value.account, action: value.action };
}
export function freezeFunction(input: FreezeIntent) {
  const intent = validateFreezeIntent(input);
  const policy = Address.fromString(FREEZE_POLICY).toScVal();
  const args =
    intent.action === 'install'
      ? [xdr.ScVal.scvU32(intent.ruleId!), policy, xdr.ScVal.scvVoid()]
      : [
          policy,
          xdr.ScVal.scvSymbol('set_frozen'),
          xdr.ScVal.scvVec([
            Address.fromString(intent.account).toScVal(),
            xdr.ScVal.scvBool(intent.action === 'freeze'),
          ]),
        ];
  return xdr.HostFunction.hostFunctionTypeInvokeContract(
    new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(intent.account).toScAddress(),
      functionName: intent.action === 'install' ? 'add_policy' : 'execute',
      args,
    }),
  ).toXdr('base64');
}
export function validatePreparedFreeze(
  prepared: PreparedTransfer,
  intent: FreezeIntent,
  key: Uint8Array,
  ledger: number,
  binding: AccountBinding,
) {
  if (binding.account !== intent.account) throw new Error('Account protection target changed.');
  validatePreparedCall(prepared, freezeFunction(intent), key, ledger, binding);
}
