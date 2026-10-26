import type { Card, CardDesign } from '@/api/types';

import { bunqRequest, unwrapList } from './client';
import { withBunqSession } from './session';

/** Fields of bunq's `CardListing` the app reads (GET /user/{userID}/card). */
type BunqCard = {
  id: number;
  created: string;
  status: string;
  second_line?: string;
  name_on_card?: string;
  primary_account_numbers?: { four_digit?: string; description?: string; status?: string }[];
  card_limit?: { value: string; currency: string };
};

type BunqPointer = { type: string; value: string; name: string };

const DESIGNS: CardDesign[] = ['a', 'b', 'c', 'd', 'e'];

/** Card faces are an app choice bunq doesn't store: kept for this run, else derived from the card ID. */
const chosenDesigns = new Map<string, CardDesign>();

/**
 * bunq statuses the app shows; LOST, STOLEN, CANCELLED and EXPIRED cards are hidden. Sandbox virtual cards stay
 * DEACTIVATED even after activation is requested, so DEACTIVATED counts as usable: the app has no freeze yet.
 */
const VISIBLE_STATUSES = ['ACTIVE', 'DEACTIVATED'];

function toCard(card: BunqCard): Card {
  const id = String(card.id);
  const pan = card.primary_account_numbers?.[0];
  return {
    id,
    label: card.second_line || pan?.description || card.name_on_card || 'Card',
    design: chosenDesigns.get(id) ?? DESIGNS[card.id % DESIGNS.length],
    last4: pan?.four_digit ?? '····',
    // The spec raises the bunq card limit by every load, so the limit is the loaded balance
    loadedBalance: Number(card.card_limit?.value ?? 0),
    createdAt: Date.parse(card.created.replace(' ', 'T')) || 0,
  };
}

/** GET /user/{userID}/card */
export function listBunqCards() {
  return withBunqSession(async ({ token, userId }) => {
    const response = await bunqRequest('GET', `/user/${userId}/card`, { token });
    return unwrapList<BunqCard>(response)
      .filter((card) => VISIBLE_STATUSES.includes(card.status))
      .map(toCard)
      .sort((a, b) => a.createdAt - b.createdAt);
  });
}

export function getBunqCard(cardId: string) {
  return withBunqSession(async ({ token, userId }) => {
    const response = await bunqRequest('GET', `/user/${userId}/card/${cardId}`, { token });
    const card = unwrapList<BunqCard>(response)[0];
    if (!card) throw new Error('This card no longer exists.');
    return toCard(card);
  });
}

/**
 * POST /user/{userID}/card-debit: a virtual Mastercard on the user's first active monetary account. `name_on_card`
 * must be one bunq allows (GET card-name); `second_line` (max 17 characters) carries the label.
 */
export function createBunqCard({ label, design }: { label: string; design: CardDesign }) {
  return withBunqSession(async ({ token, userId }) => {
    const [names, accounts] = await Promise.all([
      bunqRequest('GET', `/user/${userId}/card-name`, { token }),
      bunqRequest('GET', `/user/${userId}/monetary-account-bank`, { token }),
    ]);
    const nameOnCard = unwrapList<{ possible_card_name_array?: string[] }>(names)[0]?.possible_card_name_array?.[0];
    const iban = unwrapList<{ status: string; alias?: BunqPointer[] }>(accounts)
      .filter((account) => account.status === 'ACTIVE')
      .flatMap((account) => account.alias ?? [])
      .find((alias) => alias.type === 'IBAN');
    if (!nameOnCard || !iban) throw new Error('This bunq user has no account a card can be linked to.');

    const created = await bunqRequest('POST', `/user/${userId}/card-debit`, {
      token,
      body: {
        second_line: label,
        name_on_card: nameOnCard,
        type: 'MASTERCARD',
        product_type: 'MASTERCARD_DEBIT',
        order_status: 'VIRTUAL_DELIVERY',
        alias: { type: iban.type, value: iban.value, name: iban.name },
      },
    });
    // Returns the new card itself (`{ "CardDebit": {...} }`), not just its ID
    const card = unwrapList<BunqCard>(created)[0];
    if (!card) throw new Error('bunq did not create the card.');
    const id = String(card.id);
    chosenDesigns.set(id, design);

    // New cards come with a 1000 EUR limit; nothing is loaded yet, so start at zero and ask bunq to activate it
    await bunqRequest('PUT', `/user/${userId}/card/${id}`, {
      token,
      body: { status: 'ACTIVE', card_limit: { value: '0.00', currency: 'EUR' } },
    });
    return toCard({ ...card, card_limit: { value: '0.00', currency: 'EUR' } });
  });
}

/** PUT /user/{userID}/card/{cardID}: sets the card's spending limit in EUR. */
export function setBunqCardLimit(cardId: string, limit: number) {
  return withBunqSession(async ({ token, userId }) => {
    await bunqRequest('PUT', `/user/${userId}/card/${cardId}`, {
      token,
      body: { card_limit: { value: limit.toFixed(2), currency: 'EUR' } },
    });
  });
}
