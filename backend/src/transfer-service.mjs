import { randomUUID } from 'node:crypto';

import { publicKeyBytes, signatureBytes } from './account.mjs';
import { signedTransferAuth, validateIntent, validatePreparedTransfer } from '../../src/api/stellar/transfer-codec.ts';

export class TransferError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function makeTransferService({
  store,
  chain,
  validate = validatePreparedTransfer,
  parseIntent = validateIntent,
  sign = signedTransferAuth,
  lockKey = (r) => r.publicKey,
}) {
  const locks = new Map();
  const terminal = (record) => ['confirmed', 'failed', 'expired'].includes(record.state);
  const visible = ({ prepared, intent, state, hash, ledger, message }) => ({
    prepared,
    intent,
    state,
    hash,
    ledger,
    message,
  });
  function get(id) {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw new TransferError('Invalid approval reference.');
    const record = store.get(id);
    if (!record) throw new TransferError('Approval reference was not found. Do not repeat an uncertain action.', 404);
    return record;
  }
  async function locked(id, fn) {
    const previous = locks.get(id) || Promise.resolve();
    const task = previous.catch(() => {}).then(fn);
    locks.set(id, task);
    try {
      return await task;
    } finally {
      if (locks.get(id) === task) locks.delete(id);
    }
  }
  return {
    async prepare(publicKeyHex, input, binding) {
      let key, intent;
      try {
        key = publicKeyBytes(publicKeyHex);
        intent = parseIntent(input);
      } catch (error) {
        throw new TransferError(error.message);
      }
      const publicKey = key.toString('hex');
      if (store.active(lockKey({ publicKey, intent })))
        throw new TransferError(
          'An earlier approval still needs confirmation. Check its status before trying again.',
          409,
        );
      const prepared = { ...(await chain.prepare(key, intent, binding)), id: randomUUID() };
      const authority = binding ?? { account: prepared.account, ruleId: prepared.ruleId ?? 0 };
      validate(prepared, intent, key, prepared.latestLedger, authority);
      const record = { prepared, intent, publicKey, binding: authority, state: 'prepared' };
      store.save(record);
      return visible(record);
    },
    async submit(id, signatureHex) {
      // Validate before taking the lock. An invalid caller must not change a saved record's status.
      const initial = get(id);
      let auth;
      try {
        auth = sign(initial.prepared, publicKeyBytes(initial.publicKey), signatureBytes(signatureHex), initial.binding);
      } catch {
        throw new TransferError('The Pass signature does not authorize this action.', 401);
      }
      return locked(id, async () => {
        const record = get(id);
        // Repeated HTTP requests never create a fresh authorization or send another envelope.
        if (record.state !== 'prepared') return visible(record);
        const active = store.active(lockKey(record));
        if (active && active.prepared.id !== id)
          throw new TransferError('Another approval still needs confirmation.', 409);
        const ledger = await chain.latestLedger();
        if (ledger >= record.prepared.expirationLedger) {
          record.state = 'expired';
          record.message = 'The approval expired before submission. Review the action again.';
          store.save(record);
          return visible(record);
        }
        validate(record.prepared, record.intent, publicKeyBytes(record.publicKey), ledger, record.binding);
        // Enforce __check_auth, including the real P-256 signature, before any relay call.
        try {
          await chain.enforce(record, auth);
        } catch (error) {
          record.state = 'failed';
          record.message =
            error instanceof TransferError
              ? error.message
              : 'The signed action could not be simulated. No transaction was submitted.';
          store.save(record);
          return visible(record);
        }
        record.auth = auth;
        record.state = 'pending';
        try {
          if (!store.claim(record)) return visible(get(id));
        } catch {
          throw new TransferError(
            'Another approval is pending, or approval storage is unavailable. Nothing was submitted.',
            409,
          );
        }
        // From this point a crash/timeout is uncertain, even if Channels never returned a hash.
        try {
          const result = await chain.submit(record, auth);
          if (result.hash && /^[0-9a-f]{64}$/i.test(result.hash)) record.hash = result.hash;
          if (typeof result.transactionId === 'string') record.transactionId = result.transactionId;
          if (!record.hash && !record.transactionId) record.state = 'unknown';
        } catch {
          record.state = 'unknown';
        }
        if (record.state === 'unknown')
          record.message =
            'Submission may have reached the network. Check status; do not create a replacement approval.';
        store.save(record);
        return visible(record);
      });
    },
    async status(id) {
      return locked(id, async () => {
        const record = get(id);
        if (terminal(record)) return visible(record);
        if (record.state === 'prepared') {
          if ((await chain.latestLedger()) >= record.prepared.expirationLedger) {
            record.state = 'expired';
            record.message = 'The approval expired before submission. Review the action again.';
            store.save(record);
          }
        } else {
          const update = await chain.lookup(record);
          Object.assign(record, update);
          store.save(record);
        }
        return visible(record);
      });
    },
    close: () => store.close(),
  };
}
