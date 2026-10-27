import {
  Account,
  BASE_FEE,
  Memo,
  Operation,
  StrKey,
  TransactionBuilder,
  type Asset,
  type Transaction,
} from '@stellar/stellar-sdk/base';

import { hex } from '@/api/item/card-crypto';
import { CARD_ASSET_CODE, FUND_SLIPPAGE, type PayAsset } from '@/constants';
import i18n from '@/i18n';

import { cardAsset, NETWORK_PASSPHRASE, PAYMENT_TIMEOUT_SECONDS, receiverAddress, stellarAsset } from './config';
import { findSendPath, loadAccount, resultMessage, StellarError, submitAndConfirm } from './horizon';

export { StellarError } from './horizon';

/** An unsigned transaction from the Pass's account and the 32-byte hash the Pass signs (Stellar's Ed25519 message). */
export type PassTransaction = { transaction: Transaction; hash: Uint8Array; source: string; maxTime: number };

/** The Stellar account of a Pass: its active KeyRing's Ed25519 public key. P-256/K1 keys can't source a payment. */
export function passAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new StellarError(i18n.t('common:errors.stellar.notEd25519'));
  return StrKey.encodeEd25519PublicKey(publicKey);
}

function passTransaction(source: string, transaction: Transaction): PassTransaction {
  return { transaction, hash: transaction.hash(), source, maxTime: Number(transaction.timeBounds?.maxTime) };
}

async function loadPassAccountState(source: string) {
  const state = await loadAccount(source);
  if (!state) throw new StellarError(resultMessage('tx_no_source_account'));
  return { state, account: new Account(source, state.sequence) };
}

const txOptions = () => ({ fee: String(Number(BASE_FEE) * 10), networkPassphrase: NETWORK_PASSPHRASE });

/** Builds a `changeTrust` that lets the Pass's account hold `code` (EURC or USDC). Run before paying with it. */
export async function buildTrustline(publicKey: Uint8Array, code: PayAsset): Promise<PassTransaction> {
  const source = passAddress(publicKey);
  const asset = stellarAsset(code);
  const { state, account } = await loadPassAccountState(source);
  if (state.balanceOf(asset) !== null)
    throw new StellarError(i18n.t('common:errors.stellar.hasTrustline', { asset: code }));
  const transaction = new TransactionBuilder(account, txOptions())
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(PAYMENT_TIMEOUT_SECONDS)
    .build();
  return passTransaction(source, transaction);
}

/**
 * What a funding of `amount` EURC costs when paid with `payWith`: the same amount for EURC, or the cheapest USDC → EURC
 * path on Stellar's exchange right now.
 */
export async function quoteFund(amount: number, payWith: PayAsset): Promise<{ sourceAmount: number; path: Asset[] }> {
  if (payWith === CARD_ASSET_CODE) return { sourceAmount: amount, path: [] };
  const quote = await findSendPath(stellarAsset(payWith), cardAsset(), amount.toFixed(7));
  if (!quote) throw new StellarError(i18n.t('common:errors.stellar.noMarket', { asset: payWith }));
  return quote;
}

/** Most the payment may spend for its quote: `FUND_SLIPPAGE` above it, rounded up to Stellar's 7 decimals. */
const withSlippage = (sourceAmount: number) => Math.ceil(sourceAmount * (1 + FUND_SLIPPAGE) * 1e7) / 1e7;

/**
 * Builds a funding that delivers exactly `amount` EURC to the receiver, memo'd with the bunq card. Paid with EURC it
 * is a plain payment; paid with USDC it is a path payment converting on Stellar's exchange, spending at most the quote
 * plus `FUND_SLIPPAGE`, atomically.
 */
export async function buildFundPayment({
  publicKey,
  amount,
  cardId,
  payWith,
}: {
  publicKey: Uint8Array;
  amount: number;
  cardId: string;
  payWith: PayAsset;
}): Promise<PassTransaction & { sendMax: number }> {
  const source = passAddress(publicKey);
  const destination = receiverAddress();
  const sendAsset = stellarAsset(payWith);
  const { state, account } = await loadPassAccountState(source);
  const balance = state.balanceOf(sendAsset);
  if (balance === null) throw new StellarError(resultMessage('op_src_no_trust'));
  const quote = await quoteFund(amount, payWith);
  if (balance < quote.sourceAmount) {
    throw new StellarError(i18n.t('common:errors.stellar.underfunded', { asset: payWith }));
  }
  const destAmount = amount.toFixed(7);
  const converts = payWith !== CARD_ASSET_CODE;
  // Never above the balance: a tight balance still pays when the rate holds
  const sendMax = converts ? Math.min(withSlippage(quote.sourceAmount), balance) : amount;
  const operation = converts
    ? Operation.pathPaymentStrictReceive({
        sendAsset,
        sendMax: sendMax.toFixed(7),
        destination,
        destAsset: cardAsset(),
        destAmount,
        path: quote.path,
      })
    : Operation.payment({ destination, asset: sendAsset, amount: destAmount });
  const transaction = new TransactionBuilder(account, txOptions())
    .addOperation(operation)
    // Memo text holds 28 bytes; bunq card IDs are short numbers
    .addMemo(Memo.text(`fund card ${cardId}`.slice(0, 28)))
    .setTimeout(PAYMENT_TIMEOUT_SECONDS)
    .build();
  return { ...passTransaction(source, transaction), sendMax };
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/**
 * Attaches the Pass signature, submits, and resolves with the transaction hash once it is successful in a closed
 * ledger. `addSignature` rejects a signature that doesn't verify for the source account.
 */
export async function submitPassTransaction(signed: PassTransaction, signature: Uint8Array): Promise<string> {
  try {
    signed.transaction.addSignature(signed.source, toBase64(signature));
  } catch {
    throw new StellarError(i18n.t('common:errors.stellar.signatureMismatch'));
  }
  const result = await submitAndConfirm(signed.transaction.toXdr(), hex(signed.hash), signed.maxTime);
  return result.hash;
}
