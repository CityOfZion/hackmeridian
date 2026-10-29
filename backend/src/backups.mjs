import { FREEZE_POLICY } from '../../src/api/stellar/freeze-codec.ts';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { p256 } from '@noble/curves/nist.js';
import { Address, xdr } from '@stellar/stellar-sdk';
import {
  accountAddress,
  publicKeyBytes,
  signatureBytes,
  verifyChallengeToken,
  NETWORK_PASSPHRASE,
} from './account.mjs';
import { accountAuthority, accountClient, rpc } from './stellar.mjs';
import { openTransferStore } from './transfer-store.mjs';
import { makeTransferService, TransferError } from './transfer-service.mjs';
import { checkAccount, checkSimulation, simulationTransaction, transferChain } from './transfers.mjs';
import { AUTH_LEDGER_TTL, P256_VERIFIER, withExpiration } from '../../src/api/stellar/transfer-codec.ts';
import { backupProofDigest, validateBackupIntent, validatePreparedBackup } from '../../src/api/stellar/backup-codec.ts';

/** Build with the project's installed OpenZeppelin contract specification.
 * The phone independently reconstructs and validates the same operation with SDK 17.
 */
export function openZeppelinBackupFunction(input) {
  const intent = validateBackupIntent(input);
  const wallet = accountClient(intent.account);
  const args = wallet.spec.funcArgsToScVals('add_context_rule', {
    context_type: { tag: 'Default' },
    name: 'Backup card',
    valid_until: undefined,
    signers: [{ tag: 'External', values: [P256_VERIFIER, publicKeyBytes(intent.publicKey)] }],
    policies: intent.protected ? new Map([[FREEZE_POLICY, xdr.ScVal.scvVoid()]]) : new Map(),
  });
  return xdr.HostFunction.hostFunctionTypeInvokeContract(
    new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(intent.account).toScAddress(),
      functionName: 'add_context_rule',
      args,
    }),
  ).toXDR('base64');
}

export function verifyBackupProof(intent, proof) {
  try {
    return (
      verifyChallengeToken(process.env.CHALLENGE_SECRET, proof.digest, proof.token) &&
      p256.verify(
        signatureBytes(proof.signature),
        backupProofDigest(intent.account, Buffer.from(proof.digest, 'hex')),
        publicKeyBytes(intent.publicKey),
        { lowS: true, prehash: false },
      )
    );
  } catch {
    return false;
  }
}
export const backupChain = {
  ...transferChain,
  async prepare(key, intent, binding) {
    if (process.env.ALLOW_BACKUPS !== 'true' || !process.env.CHANNELS_API_KEY)
      throw new TransferError('Backup enrollment is not enabled.', 503);
    if (!binding || binding.account !== intent.account) throw new TransferError('Select the account to back up.');
    await checkAccount(key, binding);
    const rules = await accountAuthority(intent.account, P256_VERIFIER);
    if (rules.some((r) => r.protected) !== !!intent.protected)
      throw new TransferError('Account protection changed. Review backup enrollment again.');
    if (rules.length >= 15 || rules.some((r) => r.publicKey === intent.publicKey))
      throw new TransferError('This card is already authorized, or the account has reached its card limit.');
    const func = openZeppelinBackupFunction(intent);
    const simulation = await rpc.simulateTransaction(simulationTransaction(func), undefined, 'record');
    checkSimulation(simulation);
    if (simulation.result?.auth?.length !== 1) throw new TransferError('Expected one account approval.');
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
  async lookup(record) {
    const result = await transferChain.lookup(record);
    if (result.state === 'confirmed') {
      const rules = await accountAuthority(record.intent.account, P256_VERIFIER);
      if (!rules?.some((r) => r.publicKey === record.intent.publicKey))
        return {
          ...result,
          state: 'unknown',
          message: 'The transaction succeeded but backup membership could not be verified.',
        };
    }
    const messages = {
      pending: 'Waiting for backup enrollment confirmation. Check again without approving a replacement.',
      unknown: 'Backup enrollment may have reached the network. Check this receipt; do not add it again.',
      failed: 'The network rejected backup enrollment. The backup was not added by this transaction.',
    };
    return { ...result, message: messages[result.state] };
  },
  async enforce(record, auth) {
    if (process.env.ALLOW_BACKUPS !== 'true' || !process.env.CHANNELS_API_KEY)
      throw new TransferError('Backup enrollment is disabled.');
    await checkAccount(Buffer.from(record.publicKey, 'hex'), record.binding);
    const rules = await accountAuthority(record.intent.account, P256_VERIFIER);
    if (rules.some((r) => r.protected) !== !!record.intent.protected)
      throw new TransferError('Account protection changed. Review backup enrollment again.');
    if (rules.some((r) => r.publicKey === record.intent.publicKey))
      throw new TransferError('The backup is already authorized.');
    checkSimulation(
      await rpc.simulateTransaction(simulationTransaction(record.prepared.func, [auth]), undefined, 'enforce'),
    );
  },
};
export function createBackupService() {
  const keyOf = (record) => record.intent.account;
  const store = openTransferStore(
    process.env.BACKUP_DB_PATH ||
      (process.env.TRANSFER_DB_PATH
        ? join(dirname(process.env.TRANSFER_DB_PATH), 'backups.sqlite')
        : fileURLToPath(new URL('../data/backups.sqlite', import.meta.url))),
    keyOf,
  );
  return makeBackupService({ store });
}
export function makeBackupService({ store, chain = backupChain, authority = accountAuthority }) {
  const keyOf = (record) => record.intent.account;
  const service = makeTransferService({
    store,
    chain,
    validate: validatePreparedBackup,
    parseIntent: validateBackupIntent,
    lockKey: keyOf,
  });
  return {
    ...service,
    async prepare(key, intent, binding, proof) {
      validateBackupIntent(intent);
      if (!verifyBackupProof(intent, proof))
        throw new TransferError('The backup card proof is invalid or expired. Tap the backup again.', 401);
      return service.prepare(key, intent, binding);
    },
    async discover(publicKey) {
      const key = publicKeyBytes(publicKey);
      const addresses = [...new Set([accountAddress(key), ...store.candidates(key.toString('hex'))])];
      const accounts = [];
      for (const address of addresses) {
        const rules = await authority(address, P256_VERIFIER);
        const member = rules?.find((r) => r.publicKey === key.toString('hex'));
        if (member) accounts.push({ address, ruleId: member.ruleId, originPublicKey: rules[0].publicKey });
      }
      return accounts;
    },
    async membership(account, publicKey) {
      const rules = await authority(account, P256_VERIFIER);
      const member = rules?.find((r) => r.publicKey === publicKey);
      if (!member) throw new TransferError('Backup authorization has not been confirmed.', 409);
      return { address: account, ruleId: member.ruleId, originPublicKey: rules[0].publicKey };
    },
  };
}
