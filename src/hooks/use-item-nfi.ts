import { type CardInfo, type CardTransport, ItemSecureTunnel } from '@item-systems/item/mobile';
import { getRandomBytes } from 'expo-crypto';
import { useEffect, useState } from 'react';
import NfcManager, { NfcError, NfcTech } from 'react-native-nfc-manager';

export class NfiScanError extends Error {}

/**
 * Reads an ITEM NFI over ISO-DEP with the ITEM mobile SDK. Read-only: `connect` SELECTs the ITEM kernel and parses its
 * metadata; it never pairs, opens a session or changes card state. Resolves `null` when the user cancels the scan.
 */
async function scanItemNfi(alertMessage: string): Promise<CardInfo | null> {
  if (!(await NfcManager.isSupported())) throw new NfiScanError('This device has no NFC reader.');
  await NfcManager.start();
  if (!(await NfcManager.isEnabled())) throw new NfiScanError('NFC is turned off. Enable it in settings.');

  const transport: CardTransport = {
    async connect() {
      await NfcManager.requestTechnology(NfcTech.IsoDep, { alertMessage });
      return true;
    },
    async transmit(command) {
      // Both platforms return the response data followed by SW1/SW2, as CardTransport expects
      return Uint8Array.from(await NfcManager.isoDepHandler.transceive(Array.from(command)));
    },
    async disconnect() {
      await NfcManager.cancelTechnologyRequest().catch(() => undefined);
    },
  };

  const tunnel = new ItemSecureTunnel(transport, getRandomBytes);

  try {
    return await tunnel.connect();
  } catch (error) {
    if (error instanceof NfcError.UserCancel) return null;
    if (error instanceof Error && error.message === 'Not an ITEM application response') {
      throw new NfiScanError('This card is not an ITEM NFI.');
    }
    throw new NfiScanError('Could not read the card. Hold it still and try again.');
  } finally {
    await tunnel.close();
  }
}

export function useScanItemNfi() {
  const [isNfiScanAvailable, setIsNfiScanAvailable] = useState<boolean>();

  useEffect(() => {
    NfcManager.isSupported()
      .catch(() => false)
      .then(setIsNfiScanAvailable);
  }, []);

  return { scanItemNfi, isNfiScanAvailable };
}
