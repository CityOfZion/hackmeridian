import { HORIZON_URL } from './config';

export class StellarError extends Error {}

type HorizonProblem = {
  title?: string;
  extras?: { result_codes?: { transaction?: string; operations?: string[] } };
};

type HorizonTransaction = { hash: string; successful: boolean; ledger: number };

const RESULT_MESSAGES: Record<string, string> = {
  op_underfunded: 'Not enough USDC on this Pass’s Stellar account.',
  op_no_trust: 'This Pass’s Stellar account has no USDC trustline.',
  op_src_no_trust: 'This Pass’s Stellar account has no USDC trustline.',
  op_no_destination: 'The receiver account does not exist on Stellar.',
  op_no_issuer: 'The USDC issuer does not exist on this network.',
  op_line_full: 'The receiver cannot hold more USDC.',
  op_not_authorized: 'The receiver is not authorized to hold USDC.',
  tx_bad_seq: 'Another transaction from this Pass landed first. Try again.',
  tx_too_late: 'The signed reload expired. Try again.',
  tx_insufficient_balance: 'Not enough XLM on this Pass’s Stellar account to pay the fee.',
  tx_insufficient_fee: 'The network fee is too low right now. Try again.',
  tx_bad_auth: 'The Pass signature was not accepted for this account.',
  tx_no_source_account: 'This Pass has no Stellar account yet. Fund it with XLM first.',
};

function problemMessage(problem: HorizonProblem, status: number): string {
  const codes = problem.extras?.result_codes;
  const code = codes?.operations?.find((item) => item !== 'op_success') ?? codes?.transaction;
  if (__DEV__) console.log(`[stellar] Horizon ${status}`, problem.title ?? '', codes ?? '');
  return (code && RESULT_MESSAGES[code]) ?? `Stellar rejected the payment (${code ?? problem.title ?? status}).`;
}

async function horizon<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await fetch(`${HORIZON_URL}${path}`, init);
  return { status: response.status, body: (await response.json().catch(() => ({}))) as T };
}

/** The account's current sequence number, for the next transaction it sources. */
export async function loadSequence(address: string): Promise<string> {
  const { status, body } = await horizon<{ sequence?: string }>(`/accounts/${address}`);
  if (status === 404) throw new StellarError(RESULT_MESSAGES.tx_no_source_account);
  if (status !== 200 || !body.sequence) throw new StellarError(`Could not load the Stellar account (${status}).`);
  return body.sequence;
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
      if (!body.successful) throw new StellarError('The payment failed on Stellar.');
      return body;
    }
  }
  throw new StellarError(RESULT_MESSAGES.tx_too_late);
}
