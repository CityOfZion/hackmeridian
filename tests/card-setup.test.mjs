import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardSetupStep, selectedCardRing } from '../src/wallet/card-setup.ts';
import { pinPromptDefaults } from '../src/api/item/pin-defaults.ts';

const start = {
  identified: false,
  activationLoaded: false,
  activationComplete: false,
  activationPending: false,
  existingPersonalPin: false,
  masterReviewed: false,
};
test('cardholder setup progresses from discovery through PIN, master review and account selection', () => {
  let state = { ...start };
  assert.equal(cardSetupStep(state), 1);
  state = { ...state, identified: true };
  assert.equal(cardSetupStep(state), 2);
  state = { ...state, activationLoaded: true, activationComplete: true };
  assert.equal(cardSetupStep(state), 3);
  assert.equal(cardSetupStep({ ...state, masterReviewed: true }), 4);
});
test('pending or unreadable activation cannot be bypassed by a saved profile or previous master review', () => {
  const resumed = { ...start, identified: true, existingPersonalPin: true, masterReviewed: true };
  assert.equal(cardSetupStep(resumed), 2);
  assert.equal(cardSetupStep({ ...resumed, activationLoaded: true, activationPending: true }), 2);
  assert.equal(cardSetupStep({ ...resumed, identified: false }), 1);
});
test('existing personal PIN route only advances after activation state loads; it never prefills the initial PIN', () => {
  const existing = { ...start, identified: true, activationLoaded: true, existingPersonalPin: true };
  assert.equal(cardSetupStep(existing), 3);
  assert.equal(pinPromptDefaults({ defaults: 'personal' }).password, '');
});
test('account approval cannot use a stale keyring from another selected master; slot zero is valid', () => {
  const rings = [
    { master: 0, ring: 0, publicKey: 'first' },
    { master: 1, ring: 2, publicKey: 'second' },
  ];
  assert.equal(selectedCardRing(rings, '0', '0'), rings[0]);
  assert.equal(selectedCardRing(rings, '1', '0'), undefined);
  assert.equal(selectedCardRing(rings, '1', ''), undefined);
  assert.equal(selectedCardRing(undefined, '1', '2'), undefined);
});
