import {
  Account,
  BASE_FEE,
  Memo,
  Operation,
  StrKey,
  TransactionBuilder,
  type Transaction,
} from '@stellar/stellar-sdk/base';

import { hex } from '@/api/item/card-crypto';
import i18n from '@/i18n';

import { eurcAsset, NETWORK_PASSPHRASE, PAYMENT_TIMEOUT_SECONDS, receiverAddress } from './config';
import { loadAccount, resultMessage, StellarError, submitAndConfirm } from './horizon';

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
  const asset = eurcAsset();
  const state = await loadAccount(source, asset.getCode(), asset.getIssuer() ?? '');
  if (!state) throw new StellarError(resultMessage('tx_no_source_account'));
  return { asset, state, account: new Account(source, state.sequence) };
}

const txOptions = () => ({ fee: String(Number(BASE_FEE) * 10), networkPassphrase: NETWORK_PASSPHRASE });

/** Builds a `changeTrust` that lets the Pass's account hold EURC. Run by the user before the first fund. */
export async function buildEurcTrustline(publicKey: Uint8Array): Promise<PassTransaction> {
  const source = passAddress(publicKey);
  const { asset, state, account } = await loadPassAccountState(source);
  if (state.balance !== null) throw new StellarError(i18n.t('common:errors.stellar.hasTrustline'));
  const transaction = new TransactionBuilder(account, txOptions())
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(PAYMENT_TIMEOUT_SECONDS)
    .build();
  return passTransaction(source, transaction);
}

/** Builds `amount` EURC from the Pass's account to the receiver, memo'd with the bunq card it funds. */
export async function buildFundPayment({
  publicKey,
  amount,
  cardId,
}: {
  publicKey: Uint8Array;
  amount: number;
  cardId: string;
}): Promise<PassTransaction> {
  const source = passAddress(publicKey);
  const destination = receiverAddress();
  const { asset, state, account } = await loadPassAccountState(source);
  if (state.balance === null) throw new StellarError(resultMessage('op_src_no_trust'));
  const transaction = new TransactionBuilder(account, txOptions())
    .addOperation(Operation.payment({ destination, asset, amount: amount.toFixed(7) }))
    // Memo text holds 28 bytes; bunq card IDs are short numbers
    .addMemo(Memo.text(`fund card ${cardId}`.slice(0, 28)))
    .setTimeout(PAYMENT_TIMEOUT_SECONDS)
    .build();
  return passTransaction(source, transaction);
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
