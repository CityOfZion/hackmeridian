export const ASSET_CODE = 'EURC';
export const NETWORK_NAME = 'STELLAR TESTNET';

/** `withdraw_delay` of the Spend Vault: a requested withdrawal executes after this. */
export const WITHDRAW_DELAY_MS = 3 * 60 * 1000;
export const VAULT_DAILY_CAP = 500;
export const MAX_RELOAD = 1000;

/** ITEM application UIDs used by "Simulate tap" where there is no NFC reader (simulator, emulator). */
export const DEV_CHIP_IDS = {
  registered: '4d617961000000000000000000000001',
  unregistered: '4e657750617373000000000000000002',
} as const;
