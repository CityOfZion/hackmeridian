import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fixture, publicKey } from './transfer-fixture.mjs';
import { freezeFixture } from './freeze-fixture.mjs';
import { authorization } from './backup-fixture.mjs';
import {
  freezeFunction,
  validatePreparedFreeze,
  validateFreezeIntent,
  FREEZE_POLICY,
} from '../src/api/stellar/freeze-codec.ts';
import { backupFunction } from '../src/api/stellar/backup-codec.ts';
import { backupPublicKeyHex } from './backup-fixture.mjs';

test('freeze approvals bind action, account, policy and card rule', () => {
  const f = freezeFixture();
  validatePreparedFreeze(f.prepared, f.intent, publicKey, 1001, f.binding);
  assert.throws(() =>
    validatePreparedFreeze(f.prepared, { ...f.intent, action: 'unfreeze' }, publicKey, 1001, f.binding),
  );
  assert.throws(() =>
    validatePreparedFreeze(f.prepared, { ...f.intent, account: FREEZE_POLICY }, publicKey, 1001, f.binding),
  );
  assert.throws(() => validatePreparedFreeze({ ...f.prepared, ruleId: 1 }, f.intent, publicKey, 1001, f.binding));
  assert.throws(() => validateFreezeIntent({ ...f.intent, ruleId: 0 }));
  for (const ruleId of [-1, 15, 1.5])
    assert.throws(() => validateFreezeIntent({ ...f.intent, action: 'install', ruleId }));
  const install = { ...f.intent, action: 'install', ruleId: 0 };
  const p = authorization({ ...f.prepared, func: freezeFunction(install) }, 462n);
  validatePreparedFreeze(p, install, publicKey, 1001, f.binding);
  assert.throws(() => validatePreparedFreeze(p, { ...install, ruleId: 1 }, publicKey, 1001, f.binding));
});
test('protected backup cannot silently omit its freeze policy', () => {
  const intent = { account: fixture().prepared.account, publicKey: backupPublicKeyHex };
  assert.notEqual(backupFunction(intent), backupFunction({ ...intent, protected: true }));
});
test('contract integration fixtures are exact phone approvals, including backup unfreeze', () => {
  for (const [action, backup] of [
    ['freeze', false],
    ['unfreeze', true],
  ])
    assert.equal(
      readFileSync(new URL(`../contracts/p256-verifier/fixtures/${action}.xdr`, import.meta.url), 'utf8').trim(),
      freezeFixture(action, backup).signedAuth,
    );
});
