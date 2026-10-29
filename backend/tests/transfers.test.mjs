import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { Account, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { accountAddress, publicKeyBytes, NETWORK_PASSPHRASE, DEPLOYER } from '../src/account.mjs';
import { makeTransferService } from '../src/transfer-service.mjs';
import { openTransferStore } from '../src/transfer-store.mjs';
import { matchesTransfer } from '../src/transfers.mjs';
import { fixture, intent, publicKeyHex, publicKey } from '../../tests/transfer-fixture.mjs';
import { cardAccountAddress } from '../../src/api/stellar/transfer-codec.ts';

const signed = () => Buffer.from(fixture().signature).toString('hex');
function setup(overrides = {}, path = ':memory:') {
  let calls = 0;
  const store = openTransferStore(path);
  const chain = {
    prepare: async () => fixture().prepared,
    latestLedger: async () => 1001,
    enforce: async () => {},
    submit: async () => {
      calls++;
      return { hash: 'ab'.repeat(32) };
    },
    lookup: async () => ({ state: 'confirmed', hash: 'ab'.repeat(32), ledger: 1002 }),
    ...overrides,
  };
  return { service: makeTransferService({ store, chain }), store, calls: () => calls };
}

test('SDK16 backend and SDK17 phone derive the same account and XDR', () => {
  assert.equal(accountAddress(publicKeyBytes(publicKeyHex)), cardAccountAddress(publicKey));
  for (const v2 of [false, true]) {
    const { prepared, signedAuth } = fixture(v2);
    assert.equal(xdr.SorobanAuthorizationEntry.fromXDR(signedAuth, 'base64').toXDR('base64'), signedAuth);
    const tx = new TransactionBuilder(new Account(DEPLOYER.publicKey(), '0'), {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.invokeHostFunction({
          func: xdr.HostFunction.fromXDR(prepared.func, 'base64'),
          auth: [xdr.SorobanAuthorizationEntry.fromXDR(signedAuth, 'base64')],
        }),
      )
      .setTimeout(180)
      .build();
    assert.equal(matchesTransfer(tx.toEnvelope(), { prepared, auth: signedAuth }), true);
    assert.equal(matchesTransfer(tx.toEnvelope(), { prepared: { ...prepared, func: '' }, auth: signedAuth }), false);
  }
});

test('duplicate concurrent submits relay once, then confirmation is durable', async () => {
  const { service, calls } = setup();
  try {
    const record = await service.prepare(publicKeyHex, intent);
    const id = record.prepared.id;
    const responses = await Promise.all([service.submit(id, signed()), service.submit(id, signed())]);
    assert.equal(responses[0].state, 'pending');
    assert.equal(responses[1].state, 'pending');
    assert.equal(calls(), 1);
    assert.equal((await service.status(id)).state, 'confirmed');
    assert.equal((await service.submit(id, signed())).state, 'confirmed');
    assert.equal(calls(), 1);
  } finally {
    service.close();
  }
});

test('invalid signature and expired approval never reach the relay', async () => {
  const { service, calls } = setup({ latestLedger: async () => 1120 });
  try {
    const { prepared } = await service.prepare(publicKeyHex, intent);
    await assert.rejects(service.submit(prepared.id, '00'.repeat(64)), /signature/);
    assert.equal((await service.submit(prepared.id, signed())).state, 'expired');
    assert.equal(calls(), 0);
  } finally {
    service.close();
  }
});

test('failed enforcing simulation never reaches the relay', async () => {
  const { service, calls } = setup({
    enforce: async () => {
      throw new Error('auth rejected');
    },
  });
  try {
    const { prepared } = await service.prepare(publicKeyHex, intent);
    assert.equal((await service.submit(prepared.id, signed())).state, 'failed');
    assert.equal(calls(), 0);
  } finally {
    service.close();
  }
});

test('lost relay response survives restart and blocks replacement approval', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vaultpass-transfers-'));
  const path = join(dir, 'receipts.sqlite');
  let harness = setup(
    {
      submit: async () => {
        throw new Error('response lost');
      },
    },
    path,
  );
  try {
    const { prepared } = await harness.service.prepare(publicKeyHex, intent);
    assert.equal((await harness.service.submit(prepared.id, signed())).state, 'unknown');
    harness.service.close();
    harness = setup({ lookup: async () => ({ state: 'unknown' }) }, path);
    assert.equal((await harness.service.status(prepared.id)).state, 'unknown');
    await assert.rejects(harness.service.prepare(publicKeyHex, intent), /earlier approval/);
    assert.equal((await harness.service.submit(prepared.id, signed())).state, 'unknown');
    assert.equal(harness.calls(), 0);
  } finally {
    harness.service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
