/** Read-only compatibility probe. No relay calls, card access, signing or submission. */
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { StrKey } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist.js';
import { accountAuthority, instanceHash, rpc, VERIFIER_WASM_HASH } from '../src/stellar.mjs';
import { NETWORK_PASSPHRASE } from '../src/account.mjs';
import { openZeppelinBackupFunction } from '../src/backups.mjs';
import { simulationTransaction, checkSimulation } from '../src/transfers.mjs';
import { AUTH_LEDGER_TTL, P256_VERIFIER, withExpiration } from '../../src/api/stellar/transfer-codec.ts';
import { validatePreparedBackup } from '../../src/api/stellar/backup-codec.ts';

const [account, ...extra] = process.argv.slice(2);
if (!StrKey.isValidContract(account || '') || extra.length)
  throw new Error('Usage: pnpm --dir backend check:backup-integration <mainnet C-address>');
if ((await instanceHash(P256_VERIFIER)) !== VERIFIER_WASM_HASH)
  throw new Error('Verifier code does not match the project trust anchor.');
const rules = await accountAuthority(account, P256_VERIFIER);
if (!rules?.length) throw new Error('Account is not deployed.');
// A disposable public point exercises the contract argument without needing a second physical card.
const temporary = randomBytes(32);
const publicKey = Buffer.from(p256.getPublicKey(temporary, false)).toString('hex');
temporary.fill(0);
const intent = { account, publicKey };
const func = openZeppelinBackupFunction(intent);
const result = await rpc.simulateTransaction(simulationTransaction(func), undefined, 'record');
checkSimulation(result);
if (result.result?.auth?.length !== 1) throw new Error('Expected one current-account authorization.');
const expirationLedger = result.latestLedger + AUTH_LEDGER_TTL;
const prepared = {
  id: 'read-only-probe',
  account,
  ruleId: rules[0].ruleId,
  network: NETWORK_PASSPHRASE,
  verifier: P256_VERIFIER,
  func,
  auth: withExpiration(result.result.auth[0].toXDR('base64'), expirationLedger),
  latestLedger: result.latestLedger,
  expirationLedger,
};
validatePreparedBackup(prepared, intent, Buffer.from(rules[0].publicKey, 'hex'), result.latestLedger, {
  account,
  ruleId: rules[0].ruleId,
});
console.log(
  JSON.stringify(
    {
      network: 'mainnet',
      account,
      existingCardRules: rules.length,
      ledger: result.latestLedger,
      contractCode: 'verified',
      verifierCode: 'verified',
      openZeppelinBinding: 'matches mobile codec',
      enrollmentSimulation: 'passed',
      authorization: 'recording only; no card approval tested',
      submitted: false,
    },
    null,
    2,
  ),
);
