import i18n from '@/i18n';

import { HORIZON_URL } from './config';

export class StellarError extends Error {}

type HorizonProblem = {
  title?: string;
  extras?: { result_codes?: { transaction?: string; operations?: string[] } };
};

type HorizonTransaction = { hash: string; successful: boolean; ledger: number };

/** User-facing message for a Horizon result code (common:errors.stellar.codes), or undefined for unknown codes. */
export function resultMessage(code: string): string | undefined {
  const key = `common:errors.stellar.codes.${code}`;
  return i18n.exists(key) ? i18n.t(key as 'common:errors.stellar.codes.tx_bad_seq') : undefined;
}

function problemMessage(problem: HorizonProblem, status: number): string {
  const codes = problem.extras?.result_codes;
  const code = codes?.operations?.find((item) => item !== 'op_success') ?? codes?.transaction;
  if (__DEV__) console.log(`[stellar] Horizon ${status}`, problem.title ?? '', codes ?? '');
  return (
    (code && resultMessage(code)) ?? i18n.t('common:errors.stellar.rejected', { code: code ?? problem.title ?? status })
  );
}

async function horizon<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await fetch(`${HORIZON_URL}${path}`, init);
  return { status: response.status, body: (await response.json().catch(() => ({}))) as T };
}

type HorizonBalance = { asset_type: string; asset_code?: string; asset_issuer?: string; balance: string };

/** An account's sequence number, its balance of one asset (`null` without a trustline) and its XLM. */
export type AccountState = { sequence: string; balance: number | null; xlmBalance: number };

/** Resolves null for an account that was never funded. */
export async function loadAccount(address: string, code: string, issuer: string): Promise<AccountState | null> {
  const { status, body } = await horizon<{ sequence?: string; balances?: HorizonBalance[] }>(`/accounts/${address}`);
  if (status === 404) return null;
  if (status !== 200 || !body.sequence || !body.balances) {
    throw new StellarError(i18n.t('common:errors.stellar.loadAccount', { status }));
  }
  const line = body.balances.find((item) => item.asset_code === code && item.asset_issuer === issuer);
  const native = body.balances.find((item) => item.asset_type === 'native');
  return {
    sequence: body.sequence,
    balance: line ? Number(line.balance) : null,
    xlmBalance: Number(native?.balance ?? 0),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Submits a signed transaction and resolves once it is in a closed ledger and successful (Stellar ledgers are final).
 * Horizon's submit waits for the ledger, but can time out (504) or drop the connection first; then the hash is polled
 * until the transaction appears or its `maxTime` has passed, after which it can no longer be included.
 */
export async function submitAndConfirm(
  envelopeXdr: string,
  hash: string,
  maxTime: number,
): Promise<HorizonTransaction> {
  try {
    const { status, body } = await horizon<HorizonTransaction & HorizonProblem>('/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `tx=${encodeURIComponent(envelopeXdr)}`,
    });
    if (status === 200 && body.successful) return body;
    if (status === 400) throw new StellarError(problemMessage(body, status));
    if (__DEV__) console.log(`[stellar] submit ${hash} → ${status}; polling`);
  } catch (error) {
    if (error instanceof StellarError) throw error;
    if (__DEV__) console.log(`[stellar] submit ${hash} failed; polling`, error);
  }

  // Ledger close is ~5 s; give the network one more ledger past maxTime before declaring it expired
  while (Date.now() / 1000 < maxTime + 10) {
    await sleep(2000);
    const { status, body } = await horizon<HorizonTransaction>(`/transactions/${hash}`).catch(() => ({
      status: 0,
      body: {} as HorizonTransaction,
    }));
    if (status === 200) {
      if (!body.successful) throw new StellarError(i18n.t('common:errors.stellar.paymentFailed'));
      return body;
    }
  }
  throw new StellarError(resultMessage('tx_too_late'));
}
