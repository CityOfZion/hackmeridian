import { p256 } from '@noble/curves/nist.js';
import { fixture, privateKey, publicKey } from './transfer-fixture.mjs';
import { backupSecret, backupPublicKey, authorization } from './backup-fixture.mjs';
import { freezeFunction } from '../src/api/stellar/freeze-codec.ts';
import { transferDigest, signedTransferAuth } from '../src/api/stellar/transfer-codec.ts';
export function freezeFixture(action = 'freeze', backup = false) {
  const base = fixture().prepared;
  const intent = { account: base.account, action };
  const prepared = authorization(
    { ...base, func: freezeFunction(intent), ruleId: backup ? 1 : 0 },
    action === 'freeze' ? 460n : 461n,
  );
  const binding = { account: base.account, ruleId: prepared.ruleId };
  const secret = backup ? backupSecret : privateKey,
    key = backup ? backupPublicKey : publicKey;
  const signature = p256.sign(transferDigest(prepared), secret, { lowS: true }).toCompactRawBytes();
  return { prepared, intent, binding, signature, signedAuth: signedTransferAuth(prepared, key, signature, binding) };
}
