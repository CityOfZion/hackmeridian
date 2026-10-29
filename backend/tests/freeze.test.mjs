import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Address, xdr } from '@stellar/stellar-sdk';
import { accountClient, validateAuthority } from '../src/stellar.mjs';
import { freezeFixture } from '../../tests/freeze-fixture.mjs';
import { publicKeyHex, publicKey } from '../../tests/transfer-fixture.mjs';
import { makeTransferService } from '../src/transfer-service.mjs';
import { openTransferStore } from '../src/transfer-store.mjs';
import {
  freezeFunction,
  validateFreezeIntent,
  validatePreparedFreeze,
  FREEZE_POLICY,
} from '../../src/api/stellar/freeze-codec.ts';
import { P256_VERIFIER } from '../../src/api/stellar/transfer-codec.ts';
import { openZeppelinBackupFunction } from '../src/backups.mjs';
import { backupFunction } from '../../src/api/stellar/backup-codec.ts';
import { backupPublicKeyHex } from '../../tests/backup-fixture.mjs';

test('installed OZ bindings agree with phone freeze, unfreeze, install and protected backup calls', () => {
  const f = freezeFixture();
  const client = accountClient(f.intent.account);
  for (const action of ['install', 'freeze', 'unfreeze']) {
    const intent = { account: f.intent.account, action, ...(action === 'install' ? { ruleId: 0 } : {}) };
    const method = action === 'install' ? 'add_policy' : 'execute';
    const args = client.spec.funcArgsToScVals(
      method,
      action === 'install'
        ? { context_rule_id: 0, policy: FREEZE_POLICY, install_param: xdr.ScVal.scvVoid() }
        : {
            target: FREEZE_POLICY,
            target_fn: 'set_frozen',
            target_args: [Address.fromString(intent.account).toScVal(), xdr.ScVal.scvBool(action === 'freeze')],
          },
    );
    const func = xdr.HostFunction.hostFunctionTypeInvokeContract(
      new xdr.InvokeContractArgs({
        contractAddress: Address.fromString(intent.account).toScAddress(),
        functionName: method,
        args,
      }),
    ).toXDR('base64');
    assert.equal(func, freezeFunction(intent));
  }
  const intent = { account: f.intent.account, publicKey: backupPublicKeyHex, protected: true };
  assert.equal(openZeppelinBackupFunction(intent), backupFunction(intent));
});
test('authority accepts only the pinned freeze policy, without weakening one-card signing', () => {
  const rule = {
    id: 0,
    context_type: { tag: 'Default' },
    signers: [{ tag: 'External', values: [P256_VERIFIER, publicKey] }],
    policies: [FREEZE_POLICY],
  };
  assert.deepEqual(validateAuthority([rule], P256_VERIFIER), [{ ruleId: 0, publicKey: publicKeyHex, protected: true }]);
  assert.throws(() => validateAuthority([{ ...rule, policies: [P256_VERIFIER] }], P256_VERIFIER));
  assert.throws(() => validateAuthority([{ ...rule, signers: [] }], P256_VERIFIER));
});
test('freeze approval requires a card signature, survives an unknown submission and blocks replacement', async () => {
  const f = freezeFixture();
  const store = openTransferStore(':memory:', (r) => r.intent.account);
  let calls = 0;
  const chain = {
    prepare: async () => f.prepared,
    latestLedger: async () => 1001,
    enforce: async () => {},
    submit: async () => {
      calls++;
      throw new Error('lost response');
    },
    lookup: async () => ({ state: 'unknown' }),
  };
  const service = makeTransferService({
    store,
    chain,
    validate: validatePreparedFreeze,
    parseIntent: validateFreezeIntent,
    lockKey: (r) => r.intent.account,
  });
  try {
    const r = await service.prepare(publicKeyHex, f.intent, f.binding);
    await assert.rejects(service.submit(r.prepared.id, '00'.repeat(64)));
    assert.equal(calls, 0);
    const signature = Buffer.from(f.signature).toString('hex');
    await service.submit(r.prepared.id, signature);
    await service.submit(r.prepared.id, signature);
    assert.equal(calls, 1);
    await assert.rejects(service.prepare(publicKeyHex, f.intent, f.binding));
    assert.equal((await service.status(r.prepared.id)).state, 'unknown');
  } finally {
    service.close();
  }
});
