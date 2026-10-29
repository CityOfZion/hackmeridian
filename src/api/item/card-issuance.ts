import {
  AuthPolicy,
  MicrokernelClient,
  UacCapability,
  type ItemSecureTunnel,
  type MasterKey,
  enrollPassword,
  SPAKE2_P256_SHA256,
  SPAKE2_SECP256K1_SHA256,
  type RandomSource,
} from '@item-systems/item/mobile';
import { validCardPin } from './card-auth.ts';
import { inspectOwnedKeys } from './card-management.ts';

export const issuanceStorageKey = (uid: string) => `item.issuance.${uid}`;
export const DEFAULT_CARDHOLDER_PIN = '000000';
const phases = [
  'identity-unknown',
  'credential-ready',
  'credential-unknown',
  'reserve-ready',
  'reserve-unknown',
  'master-ready',
  'master-unknown',
  'transfer-ready',
  'transfer-unknown',
  'verify-holder',
  'personal-pin-ready',
  'personal-pin-unknown',
  'verify-personal-pin',
  'remove-default-pin',
  'remove-default-unknown',
  'complete',
] as const;
export type Issuance = {
  version: 1;
  uid: string;
  issuer: number;
  holder: number;
  issuerCanManageIdentities: boolean;
  phase: (typeof phases)[number];
  before: number[];
  master?: number;
  reserve?: number;
  credentialSlot?: number;
  personalSlot?: number;
};
type Save = (record: Issuance) => Promise<void>;
const slot = (n: unknown): n is number => Number.isInteger(n) && Number(n) >= 0 && Number(n) < 255;
const issuerIdentity = (n: unknown): n is number => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 127;
const identity = (n: unknown): n is number => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 127;

/** A malformed receipt blocks issuance; it must never be treated as an empty card. */
export function parseIssuance(raw: string, uid: string): Issuance {
  const r = JSON.parse(raw) as Issuance;
  const fields = [
    'version',
    'uid',
    'issuer',
    'holder',
    'issuerCanManageIdentities',
    'phase',
    'before',
    'master',
    'reserve',
    'credentialSlot',
    'personalSlot',
  ];
  if (
    !r ||
    Object.keys(r).some((k) => !fields.includes(k)) ||
    r.version !== 1 ||
    r.uid !== uid ||
    !issuerIdentity(r.issuer) ||
    !identity(r.holder) ||
    r.issuer === r.holder ||
    !phases.includes(r.phase) ||
    typeof r.issuerCanManageIdentities !== 'boolean' ||
    !Array.isArray(r.before) ||
    !r.before.every(slot) ||
    new Set(r.before).size !== r.before.length ||
    (r.master !== undefined && !slot(r.master)) ||
    (r.reserve !== undefined && !slot(r.reserve)) ||
    ([
      'transfer-ready',
      'transfer-unknown',
      'verify-holder',
      'personal-pin-ready',
      'personal-pin-unknown',
      'verify-personal-pin',
      'remove-default-pin',
      'remove-default-unknown',
      'complete',
    ].includes(r.phase) &&
      r.master === undefined) ||
    (r.master !== undefined && r.master === r.reserve) ||
    (r.credentialSlot !== undefined && (!slot(r.credentialSlot) || r.credentialSlot > 3)) ||
    (r.personalSlot !== undefined &&
      (!slot(r.personalSlot) || r.personalSlot > 3 || r.personalSlot === r.credentialSlot)) ||
    (!['identity-unknown', 'credential-ready', 'credential-unknown'].includes(r.phase) &&
      r.credentialSlot === undefined) ||
    (['verify-personal-pin', 'remove-default-pin', 'remove-default-unknown', 'complete'].includes(r.phase) &&
      r.personalSlot === undefined)
  )
    throw new Error('Issuance receipt needs inspection. Do not issue another masterkey.');
  return r;
}
export const issuanceBlocksChanges = (raw: string | null, uid: string) =>
  raw !== null && parseIssuance(raw, uid).phase !== 'complete';

async function context(t: ItemSecureTunnel, uid: string, holder: number, issuer?: number, creating = false) {
  if (t.info?.uid !== uid) throw new Error('Tap the selected card.');
  const c = new MicrokernelClient(t);
  const actor = await c.uac.current();
  if (!issuerIdentity(actor.uid) || (issuer !== undefined && actor.uid !== issuer))
    throw new Error('Authenticate as the original issuer identity.');
  if (!identity(holder) || holder === actor.uid) throw new Error('Choose a distinct cardholder identity (1–127).');
  const required = UacCapability.CREATE_MASTER_KEY | UacCapability.MANAGE_IDENTITIES;
  if ((actor.capabilities & required) !== required)
    throw new Error('Issuer needs masterkey creation and identity management permissions.');
  if (![1, 2].includes(t.info.tunnelProfile?.agreement ?? 0))
    throw new Error('A supported PIN exchange provider is required.');
  const target = await c.uac.query(holder);
  if (
    creating
      ? target !== null
      : !target || target.capabilities !== 0 || target.policy !== AuthPolicy.ANY_OF || target.threshold !== 1
  )
    throw new Error(
      creating
        ? 'This identity already exists. Choose an unused cardholder identity.'
        : 'Cardholder identity differs from the issuance plan.',
    );
  const owned = await inspectOwnedKeys(t);
  if (!owned.engines.length) throw new Error('No P-256 signing engine is available.');
  return { c, actor, target, masters: await c.masterkeys.getStats() };
}
function privateMaster(m: MasterKey | undefined, uid: number, anchor: boolean): asserts m is MasterKey {
  if (!m || m.uid !== uid || m.mode !== 0o700 || m.tunnelAnchor !== anchor || m.deprecated || m.rings.length)
    throw new Error('Masterkey state does not match issuance. Inspect the card before continuing.');
}

/** Start only with no pending receipt. Keys are generated by the card; no seed is imported or exported. */
export async function startIssuance(t: ItemSecureTunnel, uid: string, holder: number, save: Save) {
  const { c, actor, masters } = await context(t, uid, holder, undefined, true);
  const needed = masters.length === 0 ? 2 : 1;
  if (!t.info || t.info.masterSlots - masters.length < needed)
    throw new Error(`Issuance requires ${needed} free masterkey slots.`);
  if (masters.length && !masters.some((m) => m.tunnelAnchor))
    throw new Error('Existing card master configuration needs inspection.');
  const r: Issuance = {
    version: 1,
    uid,
    issuer: actor.uid,
    holder,
    issuerCanManageIdentities: !!(actor.capabilities & UacCapability.MANAGE_IDENTITIES),
    phase: 'identity-unknown',
    before: masters.map((m) => m.slot),
  };
  await save(r);
  const reply = await c.uac.create(holder, 0, AuthPolicy.ANY_OF, 1);
  if (reply.length) throw new Error('Unexpected identity creation acknowledgement. Inspect issuance.');
  const { target } = await context(t, uid, holder, actor.uid);
  if (target!.credentialCount !== 0) throw new Error('New identity unexpectedly has credentials.');
  const next: Issuance = { ...r, phase: 'credential-ready' };
  await save(next);
  return next;
}
async function generate(t: ItemSecureTunnel, r: Issuance, reserve: boolean, save: Save) {
  const { c, masters, target } = await context(t, r.uid, r.holder, r.issuer);
  if (target!.credentialCount !== 1) throw new Error('The initial cardholder credential changed. Inspect issuance.');
  if (masters.length !== r.before.length || masters.some((m) => !r.before.includes(m.slot)))
    throw new Error('Masterkey inventory changed. Inspect issuance.');
  const pending: Issuance = { ...r, phase: reserve ? 'reserve-unknown' : 'master-unknown' };
  await save(pending); // Persist before APDU. Failure or a lost acknowledgement is never retried here.
  const allocated = await c.masterkeys.generate();
  if (!slot(allocated) || allocated >= t.info!.masterSlots)
    throw new Error('Invalid generated master slot. Inspect issuance.');
  const after = await c.masterkeys.getStats();
  const added = after.filter((m) => !r.before.includes(m.slot));
  if (after.length !== masters.length + 1 || added.length !== 1 || added[0].slot !== allocated)
    throw new Error('Generation receipt did not match. Inspect issuance; do not generate again.');
  privateMaster(added[0], r.issuer, reserve);
  const next: Issuance = reserve
    ? { ...r, reserve: allocated, phase: 'master-ready', before: after.map((m) => m.slot) }
    : { ...r, master: allocated, phase: 'transfer-ready' };
  await save(next);
  return next;
}

/** Each call is one deliberate UI step; no loop or automatic retry of an unknown mutation. */
export async function advanceIssuance(t: ItemSecureTunnel, r: Issuance, save: Save, random: RandomSource) {
  if (r.phase === 'credential-ready') {
    const { target } = await context(t, r.uid, r.holder, r.issuer);
    if (target!.credentialCount !== 0) throw new Error('Identity already has a credential. Inspect issuance.');
    await save({ ...r, phase: 'credential-unknown' });
    const credentialSlot = await enrollPassword(
      t,
      r.holder,
      DEFAULT_CARDHOLDER_PIN,
      r.uid,
      random,
      5,
      t.info!.tunnelProfile!.agreement === 2 ? SPAKE2_P256_SHA256 : SPAKE2_SECP256K1_SHA256,
    );
    if (credentialSlot !== 0) throw new Error('Unexpected initial PIN slot. Inspect issuance.');
    const { target: after } = await context(t, r.uid, r.holder, r.issuer);
    if (after!.credentialCount !== 1) throw new Error('PIN enrollment could not be confirmed.');
    const next: Issuance = { ...r, credentialSlot, phase: r.before.length ? 'master-ready' : 'reserve-ready' };
    await save(next);
    return next;
  }
  if (r.phase === 'reserve-ready') return generate(t, r, true, save);
  if (r.phase === 'master-ready') return generate(t, r, false, save);
  if (r.phase !== 'transfer-ready') throw new Error('Inspect the previous issuance step before continuing.');
  const { c, masters, target } = await context(t, r.uid, r.holder, r.issuer);
  if (target!.credentialCount !== 1) throw new Error('The initial cardholder credential changed. Inspect issuance.');
  privateMaster(
    masters.find((m) => m.slot === r.master),
    r.issuer,
    false,
  );
  await save({ ...r, phase: 'transfer-unknown' });
  // New masters are already owner-only (0700). No broad permission window or group authority.
  await c.posix.chown(1, r.master!, r.holder, 255);
  const after = (await c.masterkeys.getStats()).find((m) => m.slot === r.master);
  privateMaster(after, r.holder, false);
  if (after.gid !== 255) throw new Error('Ownership receipt did not match. Inspect issuance.');
  const next: Issuance = { ...r, phase: 'verify-holder' };
  await save(next);
  return next;
}

/** Read-only reconciliation. A missing/ambiguous generated master stays blocked. */
export async function inspectIssuance(t: ItemSecureTunnel, r: Issuance, save: Save) {
  const { masters } = await context(t, r.uid, r.holder, r.issuer);
  let next = r;
  if (r.phase === 'identity-unknown') {
    const { target } = await context(t, r.uid, r.holder, r.issuer);
    if (target!.credentialCount !== 0) throw new Error('Identity credentials changed. Inspect before proceeding.');
    next = { ...r, phase: 'credential-ready' };
  } else if (r.phase === 'credential-unknown') {
    throw new Error(
      'PIN enrollment has an unknown outcome. Keep this receipt and inspect credential slots with a supported card manager; enrollment will not be repeated.',
    );
  } else if (r.phase === 'reserve-unknown' || r.phase === 'master-unknown') {
    const added = masters.filter((m) => !r.before.includes(m.slot));
    if (masters.length !== r.before.length + 1 || added.length !== 1)
      throw new Error(
        'No unique new masterkey can be confirmed. Keep this receipt and have issuance inspected; generation will not be repeated.',
      );
    const reserve = r.phase === 'reserve-unknown';
    privateMaster(added[0], r.issuer, reserve);
    next = reserve
      ? { ...r, reserve: added[0].slot, before: masters.map((m) => m.slot), phase: 'master-ready' }
      : { ...r, master: added[0].slot, phase: 'transfer-ready' };
  } else if (r.phase === 'transfer-unknown' || r.phase === 'transfer-ready' || r.phase === 'verify-holder') {
    const m = masters.find((m) => m.slot === r.master);
    if (!m || ![r.issuer, r.holder].includes(m.uid))
      throw new Error('Masterkey ownership does not match the issuance receipt.');
    privateMaster(m, m.uid, false);
    if (m.uid === r.holder && m.gid !== 255) throw new Error('Unexpected masterkey group.');
    next = { ...r, phase: m.uid === r.holder ? 'verify-holder' : 'transfer-ready' };
  } else if (['credential-ready', 'reserve-ready', 'master-ready'].includes(r.phase)) {
    if (masters.length !== r.before.length || masters.some((m) => !r.before.includes(m.slot)))
      throw new Error('Masterkey inventory changed.');
  } else throw new Error('This issuance has already completed.');
  await save(next);
  return next;
}

/** Must run in a NEW cardholder-authenticated session, not merely query its public identity. */
export async function verifyIssuance(t: ItemSecureTunnel, r: Issuance, save: Save) {
  if (r.phase !== 'verify-holder' || t.info?.uid !== r.uid || t.authenticatedIdentityId !== r.holder)
    throw new Error('Authenticate with the receiving cardholder PIN to verify ownership.');
  const c = new MicrokernelClient(t);
  const actor = await c.uac.current();
  if (actor.uid !== r.holder || actor.capabilities !== 0 || actor.policy !== AuthPolicy.ANY_OF || actor.threshold !== 1)
    throw new Error('Cardholder identity differs from the issuance plan.');
  const owned = await inspectOwnedKeys(t);
  privateMaster(
    owned.masters.find((m) => m.slot === r.master),
    r.holder,
    false,
  );
  const resource = await c.posix.stat(1, r.master!);
  if (resource.uid !== r.holder || resource.gid !== 255 || resource.mode !== 0o700 || !owned.engines.length)
    throw new Error('Cardholder ownership verification failed.');
  const next: Issuance = { ...r, phase: 'personal-pin-ready' };
  await save(next);
  return next;
}

async function holderSession(t: ItemSecureTunnel, r: Issuance, usedSlot: number, expectedSlot: number) {
  if (t.info?.uid !== r.uid || t.authenticatedIdentityId !== r.holder || usedSlot !== expectedSlot)
    throw new Error('Authenticate as the cardholder with the required PIN slot.');
  const c = new MicrokernelClient(t);
  const actor = await c.uac.current();
  if (actor.uid !== r.holder || actor.capabilities !== 0 || actor.policy !== AuthPolicy.ANY_OF || actor.threshold !== 1)
    throw new Error('Cardholder identity differs from the issuance plan.');
  return c;
}

export async function choosePersonalPin(
  t: ItemSecureTunnel,
  r: Issuance,
  usedSlot: number,
  password: string,
  random: RandomSource,
  save: Save,
) {
  if (r.phase !== 'personal-pin-ready' || !validCardPin(password) || password === DEFAULT_CARDHOLDER_PIN)
    throw new Error('Choose a different personal PIN with 6–12 characters.');
  const c = await holderSession(t, r, usedSlot, r.credentialSlot!);
  if ((await c.uac.current()).credentialCount !== 1)
    throw new Error('Inspect the cardholder credentials before enrollment.');
  if (![1, 2].includes(t.info?.tunnelProfile?.agreement ?? 0)) throw new Error('Unsupported PIN provider.');
  await save({ ...r, phase: 'personal-pin-unknown' });
  try {
    const personalSlot = await enrollPassword(
      t,
      r.holder,
      password,
      r.uid,
      random,
      5,
      t.info!.tunnelProfile!.agreement === 2 ? SPAKE2_P256_SHA256 : SPAKE2_SECP256K1_SHA256,
    );
    if (personalSlot === r.credentialSlot) throw new Error('Card returned the initial PIN slot.');
    const next: Issuance = { ...r, personalSlot, phase: 'verify-personal-pin' };
    await save(next);
    return next;
  } finally {
    password = '';
  }
}
export async function verifyPersonalPin(t: ItemSecureTunnel, r: Issuance, usedSlot: number, save: Save) {
  if (r.phase !== 'verify-personal-pin' || r.personalSlot === undefined)
    throw new Error('Enroll a personal PIN first.');
  await holderSession(t, r, usedSlot, r.personalSlot);
  const next: Issuance = { ...r, phase: 'remove-default-pin' };
  await save(next);
  return next;
}
export async function removeDefaultPin(t: ItemSecureTunnel, r: Issuance, usedSlot: number, save: Save) {
  if (r.phase !== 'remove-default-pin' || r.personalSlot === undefined)
    throw new Error('Verify the personal PIN before removing the initial PIN.');
  const c = await holderSession(t, r, usedSlot, r.personalSlot);
  if ((await c.uac.current()).credentialCount !== 2) throw new Error('Unexpected credentials. Inspect before removal.');
  await save({ ...r, phase: 'remove-default-unknown' });
  const reply = await c.uac.removeCredential(r.holder, r.credentialSlot!);
  if (reply.length || (await c.uac.current()).credentialCount !== 1)
    throw new Error('Initial PIN removal needs inspection. Do not repeat it.');
  const next: Issuance = { ...r, phase: 'complete' };
  await save(next);
  return next;
}

/** Public handoff metadata only; possession and ownership are checked by a fresh cardholder login. */
export function activationHandoff(raw: string, uid: string) {
  const r = parseIssuance(raw, uid);
  if (r.phase !== 'verify-holder' || r.credentialSlot !== 0 || r.personalSlot !== undefined)
    throw new Error('Use the bank handoff record made after ownership transfer.');
  return r;
}
