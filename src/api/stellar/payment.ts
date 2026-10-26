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

import { usdcAsset, NETWORK_PASSPHRASE, PAYMENT_TIMEOUT_SECONDS, receiverAddress } from './config';
import { loadSequence, StellarError, submitAndConfirm } from './horizon';

export { StellarError } from './horizon';

/** An unsigned reload payment and the 32-byte hash the Pass signs (Stellar's Ed25519 message). */
export type ReloadPayment = { transaction: Transaction; hash: Uint8Array; source: string; maxTime: number };

/** The Stellar account of a Pass: its active KeyRing's Ed25519 public key. P-256/K1 keys can't source a payment. */
export function passAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== 32)
    throw new StellarError('This Pass’s signing key is not Ed25519, so it cannot pay on Stellar.');
  return StrKey.encodeEd25519PublicKey(publicKey);
}

/** Builds `amount` USDC from the Pass's account to the receiver, memo'd with the bunq card it reloads. */
export async function buildReloadPayment({
  publicKey,
  amount,
  cardId,
}: {
  publicKey: Uint8Array;
  amount: number;
  cardId: string;
}): Promise<ReloadPayment> {
  const source = passAddress(publicKey);
  const destination = receiverAddress();
  const transaction = new TransactionBuilder(new Account(source, await loadSequence(source)), {
    fee: String(Number(BASE_FEE) * 10),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.payment({ destination, asset: usdcAsset(), amount: amount.toFixed(7) }))
    // Memo text holds 28 bytes; bunq card IDs are short numbers
    .addMemo(Memo.text(`reload card ${cardId}`.slice(0, 28)))
    .setTimeout(PAYMENT_TIMEOUT_SECONDS)
    .build();
  return { transaction, hash: transaction.hash(), source, maxTime: Number(transaction.timeBounds?.maxTime) };
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/**
 * Attaches the Pass signature, submits, and resolves with the transaction hash once it is successful in a closed
 * ledger. `addSignature` rejects a signature that doesn't verify for the source account.
 */
export async function submitReloadPayment(payment: ReloadPayment, signature: Uint8Array): Promise<string> {
  try {
    payment.transaction.addSignature(payment.source, toBase64(signature));
  } catch {
    throw new StellarError('The Pass signature does not match this Stellar transaction.');
  }
  const result = await submitAndConfirm(payment.transaction.toXdr(), hex(payment.hash), payment.maxTime);
  return result.hash;
}
