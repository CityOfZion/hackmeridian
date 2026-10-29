import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import NfcManager, { NfcAdapter, NfcEvents, NfcTech } from 'react-native-nfc-manager';
import { foregroundReader } from '@/api/nfc/foreground-reader';

export const ANDROID_READER_MODE = {
  isReaderModeEnabled: true,
  readerModeFlags: NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
  readerModeDelay: 5000,
};

export const androidReader = foregroundReader({
  async register() {
    await NfcManager.start();
    if (!(await NfcManager.isEnabled())) throw new Error('NFC is off');
    await NfcManager.registerTagEvent(ANDROID_READER_MODE);
  },
  connectPresent: () => NfcManager.connect([NfcTech.IsoDep]),
  waitForCard: () => NfcManager.requestTechnology(NfcTech.IsoDep, ANDROID_READER_MODE),
});

/** Install before login, including while fonts load and PIN dialogs are visible. */
export function useForegroundNfc() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // Unsupported/disabled NFC is reported by an explicit tap, without blocking app startup.
    const ensure = () => void androidReader.ensure().catch(() => undefined);
    ensure();
    const state = AppState.addEventListener('change', (value) => {
      if (value === 'active') ensure();
    });
    NfcManager.setEventListener(NfcEvents.StateChanged, ({ state }) => {
      if (state === 'on') ensure();
    });
    return () => {
      state.remove();
      NfcManager.setEventListener(NfcEvents.StateChanged, null);
      // Registration belongs to the process. Native Activity lifecycle suspends it
      // outside VaultPass; React remounts must not open a tag-dispatch gap.
    };
  }, []);
}
