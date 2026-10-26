import { CardError, type CardTransport, ItemSecureTunnel, MicrokernelClient } from '@item-systems/item/mobile';
import { getRandomBytes } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import NfcManager, { NfcError, NfcTech } from 'react-native-nfc-manager';

import {
  CardSigningError,
  loadCredential,
  parsePairingKey,
  samePublicKey,
  saveCredential,
  signingDigest,
  verifyCardSignature,
} from '@/api/item/card-signing';

export class NfiScanError extends Error {}

export type PassSignature = { uid: string; publicKey: Uint8Array; signature: Uint8Array };

type ScanOptions = {
  /** 32 bytes for the card to sign as given (a Stellar transaction hash). Without it, a fresh sign-in challenge. */
  digest?: Uint8Array;
  expectedUid?: string;
  /** First use only; later taps load the pairing key saved in SecureStore. */
  pairingKey?: string;
};

/**
 * Opens an authenticated ITEM tunnel and asks the active KeyRing to sign `digest`, or a fresh sign-in challenge.
 * The card's private signing key never leaves the card. Resolves null when the user cancels.
 */
async function scanItemNfi(
  alertMessage: string,
  { digest, expectedUid, pairingKey: enteredPairingKey }: ScanOptions = {},
): Promise<PassSignature | null> {
  if (!(await NfcManager.isSupported(NfcTech.IsoDep))) throw new NfiScanError('This device has no NFC reader.');
  await NfcManager.start();
  if (!(await NfcManager.isEnabled())) throw new NfiScanError('NFC is turned off. Enable it in settings.');

  const transport: CardTransport = {
    async connect() {
      await NfcManager.requestTechnology(NfcTech.IsoDep, { alertMessage });
      // Public-key export and signing can take tens of seconds on this card.
      if (Platform.OS === 'android' && 'setTimeout' in NfcManager) await NfcManager.setTimeout(120000);
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
    const info = await tunnel.connect();
    if (expectedUid && info.uid !== expectedUid) throw new CardSigningError('This is not the Pass you scanned.');
    if (!info.paired) throw new CardSigningError('This Pass is not paired yet. Complete setup in the ITEM app first.');

    const saved = await loadCredential(info.uid);
    if (!saved && !enteredPairingKey?.trim()) {
      throw new CardSigningError('Enter this Pass’s application pairing key, then tap it again.');
    }
    const pairingKey = parsePairingKey(saved?.pairingKey ?? enteredPairingKey ?? '');
    try {
      try {
        await tunnel.open(pairingKey);
      } catch (error) {
        if (error instanceof NfcError.UserCancel) throw error;
        throw new CardSigningError('Secure tunnel authentication failed. Check the application pairing key.');
      }
      const client = new MicrokernelClient(tunnel);
      let before;
      try {
        before = await client.getDiagnostics();
      } catch {
        throw new CardSigningError('The tunnel opened, but the Pass did not return signing diagnostics.');
      }
      if (before.ringCount < 1) throw new CardSigningError('This Pass has no signing KeyRing yet.');
      let publicKey;
      try {
        publicKey = await client.keyrings.exportPublicKey(before.currentRing);
      } catch (error) {
        const status =
          error instanceof CardError
            ? ` Card status: ${error.message}.`
            : ' Keep the Pass against the NFC antenna and try again.';
        throw new CardSigningError(`The tunnel opened, but the Pass could not export its signing public key.${status}`);
      }
      if (saved && !samePublicKey(publicKey, saved.publicKey)) {
        throw new CardSigningError('This Pass’s signing key changed. Re-enrollment is required.');
      }
      if (digest && digest.length !== 32) throw new CardSigningError('The Pass can only sign a 32-byte digest.');
      const challenge = digest ?? (await signingDigest(info.uid, 'sign-in', ''));
      let signature;
      try {
        signature = await client.keyrings.sign(before.currentRing, challenge);
      } catch (error) {
        const status =
          error instanceof CardError
            ? ` Card status: ${error.message}.`
            : ' Keep the Pass against the NFC antenna and try again.';
        throw new CardSigningError(`The tunnel opened, but the Pass could not sign the challenge.${status}`);
      }
      const after = await client.getDiagnostics();
      if (after.currentRing !== before.currentRing || after.ringCount !== before.ringCount) {
        throw new CardSigningError('The Pass changed its active signing ring during confirmation.');
      }
      if (!verifyCardSignature(signature, challenge, publicKey)) {
        throw new CardSigningError('The Pass signature could not be verified.');
      }
      if (!saved) await saveCredential(info.uid, pairingKey, publicKey);
      if (Platform.OS === 'ios') await NfcManager.setAlertMessageIOS('Pass signature verified').catch(() => undefined);
      return { uid: info.uid, publicKey, signature };
    } finally {
      pairingKey.fill(0);
    }
  } catch (error) {
    if (error instanceof NfcError.UserCancel) return null;
    if (error instanceof CardSigningError) throw new NfiScanError(error.message);
    if (error instanceof Error && error.message === 'Not an ITEM application response') {
      throw new NfiScanError('This card is not an ITEM NFI.');
    }
    throw new NfiScanError('Could not authenticate or sign with this Pass. Check its pairing key and hold it still.');
  } finally {
    await tunnel.close();
  }
}

/** ISO-DEP reader support: `undefined` until known. iOS checks the tag reader session, not NDEF. */
async function checkNfiScanAvailable() {
  try {
    return await NfcManager.isSupported(NfcTech.IsoDep);
  } catch {
    // Android rejects while no Activity is attached (the first screen mounts early); retry on the next check
    return undefined;
  }
}

export function useScanItemNfi() {
  const [isNfiScanAvailable, setIsNfiScanAvailable] = useState<boolean>();

  useEffect(() => {
    let mounted = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const check = (attempt = 0) =>
      checkNfiScanAvailable().then((available) => {
        if (!mounted) return;
        if (available !== undefined) setIsNfiScanAvailable(available);
        else if (attempt < 5) retry = setTimeout(() => check(attempt + 1), 500);
      });

    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      mounted = false;
      clearTimeout(retry);
      subscription.remove();
    };
  }, []);

  return { scanItemNfi, isNfiScanAvailable };
}
