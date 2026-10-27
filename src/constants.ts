/** The cards: bunq limits are EUR, so every funding delivers EURC. */
export const CARD_ASSET_CODE = 'EURC';
/**
 * What the vault (the Pass's Stellar account) holds and can pay a funding with: EURC goes through 1:1, USDC is
 * converted to EURC on Stellar's exchange in the same transaction.
 */
export const PAY_ASSETS = ['EURC', 'USDC'] as const;
export type PayAsset = (typeof PAY_ASSETS)[number];
/** Most USDC a funding may spend above its quote before the conversion fails instead (1%). */
export const FUND_SLIPPAGE = 0.01;

export const MAX_FUND = 1000;
export const MAX_CARDS = 10;
/** bunq's `second_line`, which carries the card label, holds at most 17 characters. */
export const CARD_LABEL_MAX_LENGTH = 17;

/** ITEM application UID used by "Simulate scan" for demos without a Pass or an NFC reader. */
export const DEV_CHIP_ID = '4d617961000000000000000000000001';
