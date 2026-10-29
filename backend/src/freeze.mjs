import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Address, scValToNative, xdr } from '@stellar/stellar-sdk';
import {
  FREEZE_POLICY,
  freezeFunction,
  validateFreezeIntent,
  validatePreparedFreeze,
} from '../../src/api/stellar/freeze-codec.ts';
import { AUTH_LEDGER_TTL, P256_VERIFIER, withExpiration } from '../../src/api/stellar/transfer-codec.ts';
import { NETWORK_PASSPHRASE } from './account.mjs';
import { instanceHash, accountAuthority, rpc } from './stellar.mjs';
import { transferChain, checkAccount, checkSimulation, simulationTransaction } from './transfers.mjs';
import { makeTransferService, TransferError } from './transfer-service.mjs';
import { openTransferStore } from './transfer-store.mjs';
import { FREEZE_WASM_HASH } from './freeze-release.mjs';
export async function freezeStatus(account) {
  const rules = await accountAuthority(account, P256_VERIFIER);
  if (!rules) throw new TransferError('Account not found.');
  const enabled = process.env.ALLOW_FREEZE === 'true' && (await instanceHash(FREEZE_POLICY)) === FREEZE_WASM_HASH;
  const base = {
    enabled,
    rules: rules.map((r) => r.ruleId),
    covered: rules.filter((r) => r.protected).map((r) => r.ruleId),
    frozen: null,
  };
  if (!enabled) return base;
  const func = xdr.HostFunction.hostFunctionTypeInvokeContract(
    new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(FREEZE_POLICY).toScAddress(),
      functionName: 'frozen',
      args: [Address.fromString(account).toScVal()],
    }),
  ).toXDR('base64');
  const simulation = await rpc.simulateTransaction(simulationTransaction(func));
  checkSimulation(simulation);
  const frozen = scValToNative(simulation.result.retval);
  if (typeof frozen !== 'boolean') throw new TransferError('Invalid freeze status.');
  return { ...base, frozen };
}
async function checkIntent(key, intent, binding) {
  await checkAccount(key, binding);
  if (!binding || binding.account !== intent.account) throw new TransferError('Choose this account.');
  const status = await freezeStatus(intent.account);
  if (!status.enabled || !process.env.CHANNELS_API_KEY) throw new TransferError('On-chain freeze is not enabled.', 503);
  if (intent.action === 'install') {
    if (status.covered.includes(intent.ruleId) || !status.rules.includes(intent.ruleId))
      throw new TransferError('Card protection rule changed. Refresh its status.');
  } else if (intent.action === 'freeze' && status.covered.length !== status.rules.length)
    throw new TransferError('Protect every card before freezing this account.');
  // Unfreeze must remain available during an interrupted multi-rule migration.
  return status;
}
export const freezeChain = {
  ...transferChain,
  async prepare(key, intent, binding) {
    await checkIntent(key, intent, binding);
    const func = freezeFunction(intent);
    const simulation = await rpc.simulateTransaction(simulationTransaction(func), undefined, 'record');
    checkSimulation(simulation);
    if (simulation.result?.auth?.length !== 1) throw new TransferError('Expected one card approval.');
    const expirationLedger = simulation.latestLedger + AUTH_LEDGER_TTL;
    return {
      account: intent.account,
      ruleId: binding.ruleId,
      network: NETWORK_PASSPHRASE,
      verifier: P256_VERIFIER,
      func,
      auth: withExpiration(simulation.result.auth[0].toXDR('base64'), expirationLedger),
      latestLedger: simulation.latestLedger,
      expirationLedger,
    };
  },
  async enforce(record, auth) {
    await checkIntent(Buffer.from(record.publicKey, 'hex'), record.intent, record.binding);
    checkSimulation(
      await rpc.simulateTransaction(simulationTransaction(record.prepared.func, [auth]), undefined, 'enforce'),
    );
  },
  async lookup(record) {
    const result = await transferChain.lookup(record);
    if (result.state === 'confirmed') {
      const status = await freezeStatus(record.intent.account);
      const matches =
        record.intent.action === 'install'
          ? status.covered.includes(record.intent.ruleId)
          : status.frozen === (record.intent.action === 'freeze');
      if (!matches)
        return {
          ...result,
          state: 'unknown',
          message: 'Transaction confirmed; the current protection state differs. Refresh before another approval.',
        };
    }
    return result;
  },
};
export function createFreezeService() {
  const keyOf = (r) => r.intent.account;
  const store = openTransferStore(
    process.env.FREEZE_DB_PATH ||
      join(
        process.env.TRANSFER_DB_PATH
          ? dirname(process.env.TRANSFER_DB_PATH)
          : fileURLToPath(new URL('../data', import.meta.url)),
        'freeze.sqlite',
      ),
    keyOf,
  );
  return makeTransferService({
    store,
    chain: freezeChain,
    validate: validatePreparedFreeze,
    parseIntent: validateFreezeIntent,
    lockKey: keyOf,
  });
}
