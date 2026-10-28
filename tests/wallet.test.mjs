import assert from 'node:assert/strict';
import { test } from 'node:test';
import { p256 } from '@noble/curves/nist.js';
import { cardAccountAddress } from '../src/api/stellar/transfer-codec.ts';
import {
  changeWallet,
  emptyWallet,
  keyBytes,
  parsePaymentRequest,
  parseWallet,
  paymentRequest,
  validateContact,
} from '../src/wallet/model.ts';

const enrollment = (seed, uid = 'card-one') => {
  const publicKey = Buffer.from(p256.getPublicKey(new Uint8Array(32).fill(seed), false)).toString('hex');
  const verifiedAt = '2026-10-28T12:00:00.000Z';
  return {
    type: 'enroll',
    account: {
      id: cardAccountAddress(keyBytes(publicKey)),
      cardUid: uid,
      publicKey,
      name: `Keychain ${seed}`,
      ring: seed,
      verifiedAt,
    },
    card: { uid, publicKey, name: 'My card', ring: seed, verifiedAt },
  };
};
test('multiple cards and keychains retain distinct accounts across a restart', () => {
  let data = changeWallet(emptyWallet(), enrollment(1));
  data = changeWallet(data, enrollment(2));
  data = changeWallet(data, enrollment(3, 'card-two'));
  const restored = parseWallet(JSON.stringify(data));
  assert.equal(restored.accounts.length, 3);
  assert.equal(restored.cards.length, 2);
  assert.equal(restored.selectedId, enrollment(3, 'card-two').account.id);
  assert.equal(restored.cards[0].publicKey, enrollment(2).card.publicKey);
});
test('viewing another account does not change the physical card snapshot or delete accounts', () => {
  const first = enrollment(1),
    second = enrollment(2);
  const data = changeWallet(changeWallet(emptyWallet(), first), second);
  const selected = changeWallet(data, { type: 'select', id: first.account.id });
  assert.equal(selected.selectedId, first.account.id);
  assert.deepEqual(selected.cards, data.cards);
  assert.deepEqual(selected.accounts, data.accounts);
  assert.equal(data.selectedId, second.account.id, 'does not mutate the old state');
  assert.throws(() => changeWallet(data, { type: 'select', id: 'unrecognized' }));
});
test('enrollment rejects mismatched card, address and duplicate key on another card atomically', () => {
  const first = enrollment(1),
    wrong = enrollment(2);
  const data = changeWallet(emptyWallet(), first);
  assert.throws(() => changeWallet(data, { ...wrong, account: { ...wrong.account, id: first.account.id } }));
  assert.throws(() => changeWallet(data, { ...wrong, card: { ...wrong.card, uid: 'wrong-card' } }));
  assert.throws(() => changeWallet(data, enrollment(1, 'clone-card')));
  assert.equal(data.accounts.length, 1);
});
test('re-verification preserves user names and updates card snapshot', () => {
  let data = changeWallet(emptyWallet(), enrollment(1));
  data = changeWallet(data, { type: 'renameCard', uid: 'card-one', name: 'Everyday Pass' });
  data = changeWallet(data, { type: 'renameAccount', id: data.selectedId, name: 'Everyday' });
  data = changeWallet(data, enrollment(1));
  assert.equal(data.accounts[0].name, 'Everyday');
  assert.equal(data.cards[0].name, 'Everyday Pass');
});
test('corrupt or orphaned identities and missing privacy flags fail closed', () => {
  const data = changeWallet(emptyWallet(), enrollment(1));
  for (const bad of [
    { ...data, version: 2 },
    { ...data, appLock: undefined },
    { ...data, cards: [] },
    { ...data, accounts: [...data.accounts, ...data.accounts] },
    { ...data, selectedId: 'other' },
  ])
    assert.throws(() => parseWallet(JSON.stringify(bad)));
  assert.throws(() => parseWallet('{broken'));
  assert.deepEqual(parseWallet(null), emptyWallet());
  const locked = changeWallet(data, { type: 'privacy', appLock: true, hideBalances: true });
  assert.equal(parseWallet(JSON.stringify(locked)).appLock, true);
  assert.equal(parseWallet(JSON.stringify(locked)).hideBalances, true);
});
test('contacts are validated, renamed by address and removed without affecting accounts', () => {
  const address = enrollment(1).account.id;
  let data = changeWallet(emptyWallet(), { type: 'contact', contact: { address, name: '  Alex  ' } });
  assert.equal(data.contacts[0].name, 'Alex');
  data = changeWallet(data, { type: 'contact', contact: { address, name: 'Alex home' } });
  assert.equal(data.contacts.length, 1);
  assert.throws(() => validateContact({ address: 'bad', name: 'Alex' }));
  assert.throws(() => validateContact({ address, name: ' ' }));
  assert.equal(changeWallet(data, { type: 'removeContact', address }).contacts.length, 0);
});
test('request round trip retains exact seven-decimal amount, asset and Unicode note', () => {
  const address = enrollment(1).account.id;
  const uri = paymentRequest(address, 'EURC', '0.0000001', 'Café & pão ☕');
  assert.deepEqual(parsePaymentRequest(uri), {
    recipient: address,
    asset: 'EURC',
    amount: '0.0000001',
    note: 'Café & pão ☕',
  });
});
test('requests reject unsupported network, callbacks, duplicate fields, wrong scheme, overflow and asset substitution', () => {
  const uri = paymentRequest(enrollment(1).account.id, 'XLM', '0.1');
  for (const bad of [
    uri.replace('mainnet', 'testnet'),
    uri + '&amount=100',
    uri + '&callback=https%3A%2F%2Fevil.test',
    uri.replace('vaultpass:', 'https:'),
    uri.replace('asset=XLM', 'asset=FAKE'),
    uri.replace('amount=0.1', 'amount=1e12'),
    uri + '#fragment',
    uri.replace('://pay?', '://evil/pay?'),
  ])
    assert.throws(() => parsePaymentRequest(bad));
});
