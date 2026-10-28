import AsyncStorage from '@react-native-async-storage/async-storage';

import { changeWallet, parseWallet, type WalletChange, type WalletData } from './model';

const WALLET_KEY = 'vaultpass.wallet.v1';
let queue: Promise<unknown> = Promise.resolve();
export const readWallet = async () => parseWallet(await AsyncStorage.getItem(WALLET_KEY));
/** Serialize read/modify/write, including rapid contact edits and concurrent card enrollment. */
export function writeWallet(change: WalletChange): Promise<WalletData> {
  const next = queue
    .catch(() => undefined)
    .then(async () => {
      const data = changeWallet(await readWallet(), change);
      await AsyncStorage.setItem(WALLET_KEY, JSON.stringify(data));
      return data;
    });
  queue = next;
  return next;
}
