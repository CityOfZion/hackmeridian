export const ASSET_CODE = 'EURC';

/** Placeholder vault balance until the Soroban Spend Vault is wired in (MVP). Reloads draw it down. */
export const MOCK_VAULT_BALANCE = 250;

export const MAX_RELOAD = 1000;
export const MAX_CARDS = 10;
/** bunq's `second_line`, which carries the card label, holds at most 17 characters. */
export const CARD_LABEL_MAX_LENGTH = 17;

/** ITEM application UID used by "Simulate scan" for demos without a Pass or an NFC reader. */
export const DEV_CHIP_ID = '4d617961000000000000000000000001';
