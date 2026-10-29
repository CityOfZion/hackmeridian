import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

import { ChannelsClient } from '@openzeppelin/relayer-plugin-channels';
import { Account, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { Api } from '@stellar/stellar-sdk/rpc';

import { DEPLOYER, NETWORK_PASSPHRASE, accountAddress } from './account.mjs';
import { rpc, verifyAccount, instanceHash, VERIFIER_WASM_HASH, accountAuthority } from './stellar.mjs';
import { openTransferStore } from './transfer-store.mjs';
import { makeTransferService, TransferError } from './transfer-service.mjs';
import {
  AUTH_LEDGER_TTL,
  P256_VERIFIER,
  transferFunction,
  withExpiration,
} from '../../src/api/stellar/transfer-codec.ts';

function enabled() {
  if (process.env.ALLOW_TRANSFERS !== 'true' || !process.env.CHANNELS_API_KEY) {
    throw new TransferError('Transfers are not enabled on this service.', 503);
  }
}
const channels = () =>
  new ChannelsClient({ baseUrl: 'https://channels.openzeppelin.com', apiKey: process.env.CHANNELS_API_KEY });

export function simulationTransaction(func, auth = []) {
  return new TransactionBuilder(new Account(DEPLOYER.publicKey(), '0'), {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.fromXDR(func, 'base64'),
        auth: auth.map((entry) => xdr.SorobanAuthorizationEntry.fromXDR(entry, 'base64')),
      }),
    )
    .setTimeout(180)
    .build();
}

export function checkSimulation(result) {
  if (Api.isSimulationError(result)) {
    throw new TransferError(
      'The transfer cannot execute. Check the balance and the recipient account or token trustline.',
    );
  }
  if (!Api.isSimulationSuccess(result) || Api.isSimulationRestore(result)) {
    throw new TransferError('Contract storage needs restoration before this transfer can be sent.');
  }
  const ceiling = BigInt(process.env.MAX_TRANSFER_RESOURCE_FEE || '10000000');
  if (BigInt(result.minResourceFee) > ceiling)
    throw new TransferError('The transfer exceeds the sponsorship fee limit.');
}

export async function checkAccount(key, binding) {
  if (
    process.env.P256_VERIFIER_ADDRESS !== P256_VERIFIER ||
    (await instanceHash(P256_VERIFIER)) !== VERIFIER_WASM_HASH ||
    !(await verifyAccount(binding?.account ?? accountAddress(key), key, P256_VERIFIER))
  ) {
    throw new TransferError('The expected card-controlled mainnet account is not available.');
  }
  const rules = await accountAuthority(binding?.account ?? accountAddress(key), P256_VERIFIER);
  if (!rules.some((r) => r.ruleId === (binding?.ruleId ?? 0) && r.publicKey === key.toString('hex')))
    throw new TransferError('The selected card authorization changed.');
}

/** Check the confirmed envelope, not just a relayer's claim that a hash succeeded. */
export function matchesTransfer(envelope, record) {
  let tx = TransactionBuilder.fromXDR(envelope.toXDR('base64'), NETWORK_PASSPHRASE);
  if ('innerTransaction' in tx) tx = tx.innerTransaction;
  const op = tx.operations[0];
  return (
    tx.operations.length === 1 &&
    op?.type === 'invokeHostFunction' &&
    op.func.toXDR('base64') === record.prepared.func &&
    op.auth?.length === 1 &&
    op.auth[0].toXDR('base64') === record.auth
  );
}

export const transferChain = {
  latestLedger: async () => (await rpc.getLatestLedger()).sequence,
  async prepare(key, intent, binding) {
    enabled();
    await checkAccount(key, binding);
    const account = binding?.account ?? accountAddress(key);
    const func = transferFunction(account, intent);
    const simulation = await rpc.simulateTransaction(simulationTransaction(func), undefined, 'record');
    checkSimulation(simulation);
    const auth = simulation.result?.auth;
    if (auth?.length !== 1) throw new TransferError('Expected exactly one card authorization.');
    const expirationLedger = simulation.latestLedger + AUTH_LEDGER_TTL;
    return {
      account,
      ruleId: binding?.ruleId ?? 0,
      network: NETWORK_PASSPHRASE,
      verifier: P256_VERIFIER,
      func,
      auth: withExpiration(auth[0].toXDR('base64'), expirationLedger),
      latestLedger: simulation.latestLedger,
      expirationLedger,
    };
  },
  async enforce(record, auth) {
    enabled();
    await checkAccount(Buffer.from(record.publicKey, 'hex'), record.binding);
    checkSimulation(
      await rpc.simulateTransaction(simulationTransaction(record.prepared.func, [auth]), undefined, 'enforce'),
    );
  },
  async submit(record, auth) {
    return channels().submitSorobanTransaction({ func: record.prepared.func, auth: [auth], skipWait: true });
  },
  async lookup(record) {
    let hash = record.hash;
    if (!hash && record.transactionId) {
      const response = await channels().getTransaction({ transactionId: record.transactionId });
      if (response.hash && /^[0-9a-f]{64}$/i.test(response.hash)) hash = response.hash;
    }
    if (!hash)
      return {
        state: 'unknown',
        message:
          'The relay receipt is unavailable. Do not repeat this payment; reconcile it with the service operator.',
      };
    const tx = await rpc.getTransaction(hash);
    if (tx.status === Api.GetTransactionStatus.NOT_FOUND) {
      if (tx.latestLedger >= record.prepared.expirationLedger) {
        return {
          hash,
          state: 'unknown',
          message:
            'The approval expired, but the payment outcome is still unknown. Reconcile this receipt before sending again.',
        };
      }
      return {
        hash,
        state: 'pending',
        message: 'Waiting for network confirmation. Check again without signing a new payment.',
      };
    }
    if (!matchesTransfer(tx.envelopeXdr, record)) {
      return {
        hash,
        state: 'unknown',
        message: 'The returned transaction does not match this payment. Reconciliation is required.',
      };
    }
    if (tx.status === Api.GetTransactionStatus.FAILED) {
      return {
        hash,
        state: 'failed',
        ledger: tx.ledger,
        message: 'The network rejected the transfer. No tokens were transferred.',
      };
    }
    return { hash, state: 'confirmed', ledger: tx.ledger, message: undefined };
  },
};

export function createTransferService() {
  return makeTransferService({
    store: openTransferStore(
      process.env.TRANSFER_DB_PATH || fileURLToPath(new URL('../data/transfers.sqlite', import.meta.url)),
    ),
    chain: transferChain,
  });
}
