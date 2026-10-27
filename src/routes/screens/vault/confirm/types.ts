import type { PayAsset } from '@/constants';

/** `amount` is EURC (what the card's limit rises by); `payWith` is the vault asset that pays it. */
export type TVaultConfirmScreenParams = { cardId: string; amount: number; payWith?: PayAsset };
