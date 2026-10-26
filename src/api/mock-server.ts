import { DEV_CHIP_IDS, MAX_RELOAD, VAULT_DAILY_CAP, WITHDRAW_DELAY_MS } from '@/constants';
import { activityId, mockStrkey, randomHex } from '@/utils/ids';

import type { Activity, Session, TapProof, TapResult, Vault, VaultOverview } from './types';

/**
 * In-memory stand-in for the COZ backend (spec: Auth, Vault and Webhooks modules). Each function mirrors one endpoint
 * and throws an `Error` with a user-facing message where the backend would answer 4xx. State resets on app reload.
 */

type Pass = { chipId: string; userId: string; lastCounter: number; status: 'active' | 'revoked' };
type User = { id: string; name: string };

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const db = {
  passes: new Map<string, Pass>(),
  users: new Map<string, User>(),
  vaults: new Map<string, Vault>(),
  activity: new Map<string, Activity[]>(),
  /** tapToken → chipId; every token is single use. */
  tapTokens: new Map<string, string>(),
  /** Last counter seen per chip, including chips that are not registered yet. */
  counters: new Map<string, number>(),
};

function createVault(): Vault {
  return {
    contractId: mockStrkey('C'),
    ownerAddress: mockStrkey('G'),
    balance: 0,
    dailyCap: VAULT_DAILY_CAP,
    withdrawDelayMs: WITHDRAW_DELAY_MS,
    status: 'active',
  };
}

function seed() {
  const now = Date.now();
  const userId = 'maya';
  db.users.set(userId, { id: userId, name: 'Maya Chen' });
  db.passes.set(DEV_CHIP_IDS.registered, {
    chipId: DEV_CHIP_IDS.registered,
    userId,
    lastCounter: 0,
    status: 'active',
  });
  db.vaults.set(userId, { ...createVault(), balance: 250 });
  db.activity.set(userId, [
    {
      id: activityId(),
      kind: 'deposit',
      status: 'settled',
      amount: 150,
      createdAt: now - 2 * HOUR_MS,
      ref: randomHex(8),
      txHash: randomHex(32),
    },
    {
      id: activityId(),
      kind: 'buy',
      status: 'settled',
      amount: 150,
      createdAt: now - 2 * HOUR_MS - 2 * MINUTE_MS,
      ref: `MRC-${randomHex(6)}`,
    },
    {
      id: activityId(),
      kind: 'deposit',
      status: 'settled',
      amount: 100,
      createdAt: now - 29 * HOUR_MS,
      ref: randomHex(8),
      txHash: randomHex(32),
    },
  ]);
}

seed();

/** Network latency, so loading states show up in the demo. */
function latency() {
  return new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 500));
}

/** Consumes a tap token issued by `authTap`; money-moving calls need a fresh tap of the session's own Pass. */
function consumeTap(tapToken: string, chipId: string) {
  const tokenChipId = db.tapTokens.get(tapToken);
  db.tapTokens.delete(tapToken);
  if (!tokenChipId) throw new Error('This tap has expired. Tap your Pass again.');
  if (tokenChipId !== chipId) throw new Error('This is not the Pass you signed in with.');
}

function requireUser(userId: string) {
  const vault = db.vaults.get(userId);
  const activity = db.activity.get(userId);
  if (!vault || !activity) throw new Error('Your session has ended. Sign in again.');
  return { vault, activity };
}

function chipOf(userId: string) {
  for (const pass of db.passes.values()) if (pass.userId === userId && pass.status === 'active') return pass.chipId;
  throw new Error('No active Pass for this account.');
}

/** Runs `execute_withdraw` for every request whose delay has passed (a backend job in the real system). */
function settleDueWithdrawals(vault: Vault, activity: Activity[], now = Date.now()) {
  for (const item of activity) {
    if (item.kind !== 'withdraw' || item.status !== 'pending' || (item.availableAt ?? 0) > now) continue;
    item.status = 'settled';
    item.txHash = randomHex(32);
    vault.balance -= item.amount;
  }
}

function pendingWithdrawals(activity: Activity[]) {
  return activity
    .filter((item) => item.kind === 'withdraw' && item.status === 'pending')
    .reduce((sum, item) => sum + item.amount, 0);
}

function overview(vault: Vault, activity: Activity[]): VaultOverview {
  // Copies, so RTK Query can freeze the result without freezing the "database"
  return {
    vault: { ...vault },
    activity: activity.map((item) => ({ ...item })).sort((a, b) => b.createdAt - a.createdAt),
  };
}

/** POST /auth/tap */
export async function authTap({ chipId, counter }: TapProof): Promise<TapResult> {
  await latency();
  if (counter <= (db.counters.get(chipId) ?? 0)) throw new Error('This tap was already used. Tap your Pass again.');
  db.counters.set(chipId, counter);

  const pass = db.passes.get(chipId);
  if (pass?.status === 'revoked') throw new Error('This Pass has been revoked.');

  const tapToken = randomHex(16);
  db.tapTokens.set(tapToken, chipId);
  return { chipId, tapToken, registered: Boolean(pass) };
}

/** POST /auth/passkey/register: binds a new Pass to a new user and deploys their vault. */
export async function passkeyRegister({ tapToken, chipId, name }: { tapToken: string; chipId: string; name: string }) {
  await latency();
  consumeTap(tapToken, chipId);
  if (db.passes.has(chipId)) throw new Error('This Pass is already registered.');

  const userId = randomHex(8);
  db.users.set(userId, { id: userId, name });
  db.passes.set(chipId, { chipId, userId, lastCounter: 0, status: 'active' });
  db.vaults.set(userId, createVault());
  db.activity.set(userId, []);
  return { userId, chipId, name } satisfies Session;
}

/** POST /auth/passkey/verify */
export async function passkeyVerify({ tapToken, chipId }: { tapToken: string; chipId: string }) {
  await latency();
  consumeTap(tapToken, chipId);
  const pass = db.passes.get(chipId);
  const user = pass && db.users.get(pass.userId);
  if (!user) throw new Error('This Pass is not registered.');
  return { userId: user.id, chipId, name: user.name } satisfies Session;
}

/** GET /vault */
export async function getVault({ userId }: { userId: string }) {
  await latency();
  const { vault, activity } = requireUser(userId);
  settleDueWithdrawals(vault, activity);
  return overview(vault, activity);
}

/**
 * POST /buy/session, then the Mercuryo webhook and the Aeroglyph-signed `deposit(from, amount)`, collapsed into one
 * call: EURC is bought to the owner's G-account and moved into the vault.
 */
export async function reload({ userId, amount, tapToken }: { userId: string; amount: number; tapToken: string }) {
  await latency();
  const { vault, activity } = requireUser(userId);
  consumeTap(tapToken, chipOf(userId));
  if (!(amount > 0) || amount > MAX_RELOAD) throw new Error(`Reload between 0.01 and ${MAX_RELOAD} EURC.`);

  const now = Date.now();
  const buy: Activity = {
    id: activityId(),
    kind: 'buy',
    status: 'settled',
    amount,
    createdAt: now,
    ref: `MRC-${randomHex(6)}`,
  };
  const deposit: Activity = {
    id: activityId(),
    kind: 'deposit',
    status: 'settled',
    amount,
    createdAt: now + 1,
    ref: randomHex(8),
    txHash: randomHex(32),
  };
  activity.push(buy, deposit);
  vault.balance += amount;
  return deposit;
}

/** `request_withdraw(to, amount)`, signed by the owner; executes after the vault's withdraw delay. */
export async function requestWithdraw({
  userId,
  amount,
  destination,
  tapToken,
}: {
  userId: string;
  amount: number;
  destination: string;
  tapToken: string;
}) {
  await latency();
  const { vault, activity } = requireUser(userId);
  consumeTap(tapToken, chipOf(userId));
  if (vault.status === 'frozen') throw new Error('Your vault is frozen.');
  settleDueWithdrawals(vault, activity);
  if (!(amount > 0) || amount > vault.balance - pendingWithdrawals(activity)) {
    throw new Error('Not enough free balance in your vault.');
  }

  const now = Date.now();
  const withdrawal: Activity = {
    id: activityId(),
    kind: 'withdraw',
    status: 'pending',
    amount,
    createdAt: now,
    ref: randomHex(8),
    destination,
    availableAt: now + vault.withdrawDelayMs,
  };
  activity.push(withdrawal);
  return withdrawal;
}
