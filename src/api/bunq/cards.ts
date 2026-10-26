import type { Card, CardDesign } from '@/api/types';
import i18n from '@/i18n';

import { BunqError, bunqRequest, unwrapList } from './client';
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
 * bunq statuses the app shows; LOST, STOLEN, CANCELLED and EXPIRED cards are hidden. Virtual cards can stay
 * DEACTIVATED after activation is requested (seen in the sandbox), so DEACTIVATED counts as usable: the app has no freeze yet.
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

/** Every card bunq returns, hidden statuses included. Logs id, status and label so hidden or pending cards show up. */
async function fetchAllCards(token: string, userId: number): Promise<BunqCard[]> {
  const cards = unwrapList<BunqCard>(await bunqRequest('GET', `/user/${userId}/card`, { token }));
  console.log(
    '[bunq] cards',
    cards.map((card) => `${card.id} ${card.status} "${card.second_line ?? ''}"`),
  );
  return cards;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * After card-debit times out (bunq's gateway answers 504 at 30 s while its back end may still finish), polls for a
 * card that wasn't there before and carries `label`. Never re-POSTs: a retry could order a second, paid card.
 */
async function waitForCreatedCard(token: string, userId: number, knownIds: Set<number>, label: string) {
  for (let attempt = 0; attempt < 12; attempt++) {
    await sleep(5000);
    const card = (await fetchAllCards(token, userId)).find(
      (item) => !knownIds.has(item.id) && item.second_line === label,
    );
    if (card) return card;
  }
  return undefined;
}

/** GET /user/{userID}/card */
export function listBunqCards() {
  return withBunqSession(async ({ token, userId }) => {
    return (await fetchAllCards(token, userId))
      .filter((card) => VISIBLE_STATUSES.includes(card.status))
      .map(toCard)
      .sort((a, b) => a.createdAt - b.createdAt);
  });
}

export function getBunqCard(cardId: string) {
  return withBunqSession(async ({ token, userId }) => {
    const response = await bunqRequest('GET', `/user/${userId}/card/${cardId}`, { token });
    const card = unwrapList<BunqCard>(response)[0];
    if (!card) throw new Error(i18n.t('common:errors.bunq.cardGone'));
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
    if (!nameOnCard || !iban) throw new Error(i18n.t('common:errors.bunq.noAccount'));

    const knownIds = new Set((await fetchAllCards(token, userId)).map((item) => item.id));
    let card: BunqCard | undefined;
    try {
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
      card = unwrapList<BunqCard>(created)[0];
    } catch (error) {
      // 5xx or a dropped connection: the order may still go through on bunq's side
      if (error instanceof BunqError && error.status < 500) throw error;
      console.log('[bunq] card-debit did not answer; looking for the new card', String(error));
      card = await waitForCreatedCard(token, userId, knownIds, label);
      if (!card) throw new Error(i18n.t('common:errors.bunq.creationPending'));
    }
    if (!card) throw new Error(i18n.t('common:errors.bunq.notCreated'));
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

/**
 * PUT /user/{userID}/card/{cardID} with status CANCELLED: bunq has no card delete. Permanent, and bunq only accepts it
 * once the card's order was issued; it answers with an error for a card still being ordered.
 */
export function cancelBunqCard(cardId: string) {
  return withBunqSession(async ({ token, userId }) => {
    await bunqRequest('PUT', `/user/${userId}/card/${cardId}`, { token, body: { status: 'CANCELLED' } });
    chosenDesigns.delete(cardId);
  });
}
