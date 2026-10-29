import { StrKey } from '@stellar/stellar-sdk/base';

import {
  cardAccountAddress,
  validateIntent,
  type TransferAsset,
  type TransferIntent,
} from '../api/stellar/transfer-codec.ts';

export type WalletSigner = { cardUid: string; publicKey: string; ring?: number; ruleId: number };
export type WalletAccount = {
  originPublicKey?: string;
  ruleId?: number;
  signers?: WalletSigner[];
  id: string;
  cardUid: string;
  publicKey: string;
  name: string;
  ring?: number;
  verifiedAt: string;
};
export type WalletCard = {
  uid: string;
  name: string;
  publicKey: string;
  firmware?: string;
  ring?: number;
  ringCount?: number;
  verifiedAt: string;
};
export type Contact = { address: string; name: string };
export type WalletData = {
  version: 1;
  accounts: WalletAccount[];
  cards: WalletCard[];
  contacts: Contact[];
  selectedId?: string;
  hideBalances: boolean;
  appLock: boolean;
};
export const emptyWallet = (): WalletData => ({
  version: 1,
  accounts: [],
  cards: [],
  contacts: [],
  hideBalances: false,
  appLock: false,
});
export const keyBytes = (key: string) => Uint8Array.from(key.match(/../g) ?? [], (byte) => parseInt(byte, 16));
export const shortAddress = (value: string) => `${value.slice(0, 6)}…${value.slice(-6)}`;

export function validateAccount(account: WalletAccount): WalletAccount {
  if (
    !account ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(account.cardUid) ||
    !/^04[0-9a-f]{128}$/.test(account.publicKey) ||
    cardAccountAddress(keyBytes(account.originPublicKey ?? account.publicKey)) !== account.id ||
    !account.name?.trim() ||
    account.name.length > 40 ||
    !Number.isFinite(Date.parse(account.verifiedAt)) ||
    (account.ring !== undefined && (!Number.isInteger(account.ring) || account.ring < 0))
  ) {
    throw new Error('The saved account identity is invalid.');
  }
  const signers = accountSigners(account);
  if (
    !signers.length ||
    signers.length > 15 ||
    new Set(signers.map((s) => s.ruleId)).size !== signers.length ||
    new Set(signers.map((s) => s.publicKey)).size !== signers.length ||
    !signers.some(
      (s) => s.publicKey === account.publicKey && s.cardUid === account.cardUid && s.ruleId === (account.ruleId ?? 0),
    )
  )
    throw new Error('Invalid account card bindings.');
  for (const signer of signers) {
    if (
      !/^[a-zA-Z0-9_-]{1,128}$/.test(signer.cardUid) ||
      !/^04[0-9a-f]{128}$/.test(signer.publicKey) ||
      !Number.isInteger(signer.ruleId) ||
      signer.ruleId < 0 ||
      signer.ruleId > 14 ||
      (signer.ring !== undefined && (!Number.isInteger(signer.ring) || signer.ring < 0))
    )
      throw new Error('Invalid backup card identity.');
    cardAccountAddress(keyBytes(signer.publicKey));
  }
  return account;
}
export const accountSigners = (a: WalletAccount): WalletSigner[] =>
  a.signers ?? [{ cardUid: a.cardUid, publicKey: a.publicKey, ring: a.ring, ruleId: a.ruleId ?? 0 }];
export const accountBinding = (a: WalletAccount) => ({ account: a.id, ruleId: a.ruleId ?? 0 });

export function validateContact(contact: Contact): Contact {
  const address = contact.address.trim();
  const name = contact.name.trim();
  if (!name || name.length > 40) throw new Error('Enter a name of up to 40 characters.');
  if (!StrKey.isValidContract(address) && !StrKey.isValidEd25519PublicKey(address))
    throw new Error('Enter a valid Stellar G or C address.');
  return { name, address };
}

/** Fail closed on corrupt storage; never silently replace saved identities or privacy settings. */
export function parseWallet(value: string | null): WalletData {
  if (value === null) return emptyWallet();
  const data = JSON.parse(value) as WalletData;
  if (
    data.version !== 1 ||
    !Array.isArray(data.accounts) ||
    !Array.isArray(data.cards) ||
    !Array.isArray(data.contacts) ||
    typeof data.appLock !== 'boolean' ||
    typeof data.hideBalances !== 'boolean'
  )
    throw new Error('Cannot read this wallet backup.');
  data.accounts.forEach(validateAccount);
  data.contacts.forEach(validateContact);
  if (
    new Set(data.accounts.map((a) => a.id)).size !== data.accounts.length ||
    new Set(data.cards.map((c) => c.uid)).size !== data.cards.length ||
    data.accounts.some((a) => !accountSigners(a).every((s) => data.cards.some((c) => c.uid === s.cardUid))) ||
    data.cards.some(
      (c) =>
        !c.name?.trim() ||
        c.name.length > 40 ||
        !data.accounts.some((a) => accountSigners(a).some((s) => s.cardUid === c.uid && s.publicKey === c.publicKey)),
    ) ||
    (data.selectedId && !data.accounts.some((a) => a.id === data.selectedId))
  )
    throw new Error('Saved card and account identities do not match.');
  return data;
}

export type WalletChange =
  | { type: 'enroll'; account: WalletAccount; card: WalletCard }
  | { type: 'select'; id: string }
  | { type: 'selectSigner'; id: string; publicKey: string }
  | { type: 'renameAccount'; id: string; name: string }
  | { type: 'renameCard'; uid: string; name: string }
  | { type: 'contact'; contact: Contact }
  | { type: 'removeContact'; address: string }
  | { type: 'privacy'; hideBalances?: boolean; appLock?: boolean };

export function changeWallet(data: WalletData, change: WalletChange): WalletData {
  const next: WalletData = {
    ...data,
    accounts: data.accounts.map((a) => ({ ...a })),
    cards: data.cards.map((c) => ({ ...c })),
    contacts: data.contacts.map((c) => ({ ...c })),
  };
  switch (change.type) {
    case 'enroll': {
      validateAccount(change.account);
      if (change.account.cardUid !== change.card.uid || change.account.publicKey !== change.card.publicKey)
        throw new Error('The card proof does not match the account.');
      const existing = next.accounts.find((a) => a.id === change.account.id);
      const priorSigners = existing ? accountSigners(existing) : [];
      if (priorSigners.some((s) => s.publicKey === change.account.publicKey && s.cardUid !== change.card.uid))
        throw new Error('This key is already linked to another card.');
      const mergedSigners = [
        ...priorSigners.filter((s) => s.publicKey !== change.account.publicKey),
        ...accountSigners(change.account),
      ];
      const card = next.cards.find((c) => c.uid === change.card.uid);
      next.accounts = [
        ...next.accounts.filter((a) => a.id !== change.account.id),
        { ...change.account, signers: mergedSigners, name: existing?.name ?? change.account.name },
      ];
      next.cards = [
        ...next.cards.filter((c) => c.uid !== change.card.uid),
        { ...change.card, name: card?.name ?? change.card.name },
      ];
      next.selectedId = change.account.id;
      break;
    }
    case 'selectSigner': {
      const account = next.accounts.find((a) => a.id === change.id);
      const signer = account && accountSigners(account).find((s) => s.publicKey === change.publicKey);
      if (!account || !signer) throw new Error('Card is not linked to this account.');
      Object.assign(account, signer);
      break;
    }
    case 'select':
      if (!next.accounts.some((a) => a.id === change.id)) throw new Error('Account not found.');
      next.selectedId = change.id;
      break;
    case 'renameAccount':
    case 'renameCard': {
      const name = change.name.trim();
      if (!name || name.length > 40) throw new Error('Enter a name of up to 40 characters.');
      if (change.type === 'renameAccount')
        next.accounts = next.accounts.map((a) => (a.id === change.id ? { ...a, name } : a));
      else next.cards = next.cards.map((c) => (c.uid === change.uid ? { ...c, name } : c));
      break;
    }
    case 'contact': {
      const contact = validateContact(change.contact);
      next.contacts = [...next.contacts.filter((c) => c.address !== contact.address), contact].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      break;
    }
    case 'removeContact':
      next.contacts = next.contacts.filter((c) => c.address !== change.address);
      break;
    case 'privacy':
      if (change.hideBalances !== undefined) next.hideBalances = change.hideBalances;
      if (change.appLock !== undefined) next.appLock = change.appLock;
  }
  return parseWallet(JSON.stringify(next));
}

/** A VaultPass request is deliberately distinct from SEP-7 classic payment operations (which cannot pay C accounts). */
export function paymentRequest(address: string, asset: TransferAsset, amount: string, note = ''): string {
  validateIntent({ recipient: address, asset, amount });
  if (note.length > 140) throw new Error('Keep the request note under 140 characters.');
  return `vaultpass://pay?${new URLSearchParams({ network: 'mainnet', recipient: address, asset, amount, note })}`;
}
export function parsePaymentRequest(uri: string): TransferIntent & { note: string } {
  const url = new URL(uri);
  if (
    uri.length > 2048 ||
    url.protocol !== 'vaultpass:' ||
    url.host !== 'pay' ||
    url.pathname !== '' ||
    url.hash ||
    url.username ||
    url.password ||
    url.port ||
    url.searchParams.get('network') !== 'mainnet'
  )
    throw new Error('Use a VaultPass mainnet payment request.');
  const allowed = ['network', 'recipient', 'asset', 'amount', 'note'];
  for (const key of url.searchParams.keys())
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1)
      throw new Error('Unsupported or duplicate payment request field.');
  const note = url.searchParams.get('note') ?? '';
  if (note.length > 140) throw new Error('The request note is too long.');
  return {
    ...validateIntent({
      recipient: url.searchParams.get('recipient') ?? '',
      asset: url.searchParams.get('asset') as TransferAsset,
      amount: url.searchParams.get('amount') ?? '',
    }),
    note,
  };
}
