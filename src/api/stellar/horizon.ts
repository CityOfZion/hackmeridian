import i18n from '@/i18n';

import { Asset } from '@stellar/stellar-sdk/base';

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

/** An account's sequence number, its XLM, and its balance of each asset it trusts. */
export type AccountState = {
  sequence: string;
  xlmBalance: number;
  /** Balance of `asset`, or null without a trustline for it. */
  balanceOf: (asset: Asset) => number | null;
};

/** Resolves null for an account that was never funded. */
export async function loadAccount(address: string): Promise<AccountState | null> {
  const { status, body } = await horizon<{ sequence?: string; balances?: HorizonBalance[] }>(`/accounts/${address}`);
  if (status === 404) return null;
  if (status !== 200 || !body.sequence || !body.balances) {
    throw new StellarError(i18n.t('common:errors.stellar.loadAccount', { status }));
  }
  const balances = body.balances;
  const native = balances.find((item) => item.asset_type === 'native');
  return {
    sequence: body.sequence,
    xlmBalance: Number(native?.balance ?? 0),
    balanceOf: (asset) => {
      const line = balances.find(
        (item) => item.asset_code === asset.getCode() && item.asset_issuer === asset.getIssuer(),
      );
      return line ? Number(line.balance) : null;
    },
  };
}

type HorizonPathAsset = { asset_type: string; asset_code?: string; asset_issuer?: string };
type HorizonPath = { source_amount: string; path: HorizonPathAsset[] };

const toAsset = (item: HorizonPathAsset) =>
  item.asset_type === 'native' ? Asset.native() : new Asset(item.asset_code ?? '', item.asset_issuer ?? '');

const assetParam = (prefix: string, asset: Asset) =>
  asset.isNative()
    ? `${prefix}_type=native`
    : `${prefix}_type=${asset.getAssetType()}&${prefix}_code=${asset.getCode()}&${prefix}_issuer=${asset.getIssuer()}`;

/**
 * Cheapest way on Stellar's exchange (order books and AMMs) to deliver exactly `destAmount` of `destAsset` by spending
 * `sendAsset`: how much it costs now and the intermediate assets, if any. Undefined when there is no market.
 */
export async function findSendPath(
  sendAsset: Asset,
  destAsset: Asset,
  destAmount: string,
): Promise<{ sourceAmount: number; path: Asset[] } | undefined> {
  const source = sendAsset.isNative() ? 'native' : `${sendAsset.getCode()}:${sendAsset.getIssuer()}`;
  const { status, body } = await horizon<{ _embedded?: { records?: HorizonPath[] } }>(
    `/paths/strict-receive?${assetParam('destination_asset', destAsset)}&destination_amount=${destAmount}&source_assets=${source}`,
  );
  if (status !== 200) throw new StellarError(i18n.t('common:errors.stellar.quoteFailed', { status }));
  const best = (body._embedded?.records ?? []).sort((a, b) => Number(a.source_amount) - Number(b.source_amount))[0];
  return best && { sourceAmount: Number(best.source_amount), path: best.path.map(toAsset) };
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
