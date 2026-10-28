import { CardError, type CardTransport, ItemSecureTunnel, MicrokernelClient } from '@item-systems/item/mobile';
import { getRandomBytes } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import NfcManager, { NfcAdapter, NfcError, NfcTech } from 'react-native-nfc-manager';

import {
  CardSigningError,
  loadCredential,
  markPaired,
  normalizeP256Signature,
  parsePairingKey,
  samePublicKey,
  saveCredential,
  signingDigest,
  verifyCardSignature,
} from '@/api/item/card-signing';
import i18n from '@/i18n';

export class NfiScanError extends Error {
  constructor(
    message: string,
    /** `pairing-key-required`: the tapped Pass has no saved pairing key and none was entered. */
    readonly code?: 'pairing-key-required' | 'key-changed',
  ) {
    super(message);
  }
}

/** Stages of a tap, in order, as shown by the tap modal (and the iOS NFC sheet); messages in common:tap.steps. */
export const TAP_STEPS = ['waiting', 'detected', 'authenticating', 'reading-key', 'signing', 'verifying'] as const;

export type TapStep = (typeof TAP_STEPS)[number];

export const tapStepMessage = (step: TapStep) => i18n.t(`common:tap.steps.${step}`);

/** Set by `cancelNfiScan`, so the aborted tap resolves as a cancel instead of an error. */
let cancelRequested = false;

/** Stops the tap in progress (the modal's Cancel); the tap resolves null. */
export async function cancelNfiScan() {
  cancelRequested = true;
  await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 }).catch(() => undefined);
}

/** Android gives up waiting for a Pass after this long; iOS ends its own reader sheet after 60 s. */
const TAP_TIMEOUT_MS = 30000;

/**
 * Android reader mode instead of foreground dispatch: the app gets the tag directly, ahead of Google Wallet and the
 * system's tag dispatch, and card emulation pauses. A long presence-check delay keeps the platform from pinging the
 * card during slow key export and signing.
 */
const ANDROID_READER_MODE = {
  isReaderModeEnabled: true,
  readerModeFlags: NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
  readerModeDelay: 5000,
};

const hexByte = (byte: number | undefined) => (byte ?? 0).toString(16).padStart(2, '0');
const shortUid = (uid: string) => `${uid.slice(0, 6)}…${uid.slice(-4)}`;
const errorText = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));

/**
 * `[nfi]` logs for every step of a tap, with milliseconds since the tap started. They print in all builds (Metro in
 * development, `adb logcat -s ReactNativeJS` on a release APK) and never include the pairing key, digests or APDU data.
 */
function nfiLogger() {
  const startedAt = Date.now();
  return (step: string, details?: unknown) =>
    console.log(`[nfi] +${Date.now() - startedAt}ms ${step}`, ...(details === undefined ? [] : [details]));
}

export type PassSignature = {
  uid: string;
  publicKey: Uint8Array;
  signature: Uint8Array;
  ring: number;
  ringCount: number;
  firmware: string;
};

type ScanOptions = {
  /** 32 bytes for the card to sign as given (a Stellar transaction hash). Without it, a fresh sign-in challenge. */
  digest?: Uint8Array;
  expectedUid?: string;
  expectedPublicKey?: string;
  /** First use only; later taps load the pairing key saved in SecureStore. */
  pairingKey?: string;
  /** Called as the tap moves through its stages. */
  onStep?: (step: TapStep) => void;
};

/**
 * Opens an authenticated ITEM tunnel and asks the active KeyRing to sign `digest`, or a fresh sign-in challenge.
 * The card's private signing key never leaves the card. Resolves null when the user cancels.
 */
async function scanItemNfi(
  alertMessage: string,
  { digest, expectedUid, expectedPublicKey, pairingKey: enteredPairingKey, onStep }: ScanOptions = {},
): Promise<PassSignature | null> {
  const log = nfiLogger();
  cancelRequested = false;
  const step = (next: TapStep) => {
    onStep?.(next);
    if (Platform.OS === 'ios') NfcManager.setAlertMessageIOS(tapStepMessage(next)).catch(() => undefined);
  };
  log('tap started', {
    mode: digest ? 'sign digest' : 'sign-in',
    expectedUid: expectedUid && shortUid(expectedUid),
    platform: Platform.OS,
  });
  if (!(await NfcManager.isSupported(NfcTech.IsoDep))) {
    log('no ISO-DEP reader');
    throw new NfiScanError(i18n.t('common:errors.nfc.noReader'));
  }
  await NfcManager.start();
  if (!(await NfcManager.isEnabled())) {
    log('NFC is off');
    throw new NfiScanError(i18n.t('common:errors.nfc.off'));
  }
  log('NFC ready');
  let apdus = 0;
  let timedOut = false;

  const transport: CardTransport = {
    async connect() {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      if (Platform.OS === 'android') {
        // A request or tag registration left by an earlier tap makes this one wait forever (and keeps its old
        // dispatch mode), so start from a clean state
        await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 }).catch(() => undefined);
        await NfcManager.unregisterTagEvent().catch(() => undefined);
        timeout = setTimeout(() => {
          timedOut = true;
          log(`no Pass detected after ${TAP_TIMEOUT_MS / 1000}s; cancelling`);
          NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 }).catch(() => undefined);
        }, TAP_TIMEOUT_MS);
      }
      step('waiting');
      log('waiting for the Pass (requestTechnology IsoDep)', Platform.OS === 'android' ? 'reader mode' : undefined);
      try {
        await NfcManager.requestTechnology(NfcTech.IsoDep, { alertMessage, ...ANDROID_READER_MODE });
      } finally {
        clearTimeout(timeout);
      }
      const tag = await NfcManager.getTag().catch(() => null);
      step('detected');
      log('Pass detected', { techTypes: tag?.techTypes, id: tag?.id ? 'present' : 'none' });
      // Public-key export and signing can take tens of seconds on this card.
      if (Platform.OS === 'android' && 'setTimeout' in NfcManager) await NfcManager.setTimeout(120000);
      return true;
    },
    async transmit(command) {
      const index = ++apdus;
      const sentAt = Date.now();
      // Header only (CLA INS P1 P2): tunnel payloads stay out of the logs
      const header = Array.from(command.slice(0, 4), hexByte).join(' ');
      try {
        // Both platforms return the response data followed by SW1/SW2, as CardTransport expects
        const response = Uint8Array.from(await NfcManager.isoDepHandler.transceive(Array.from(command)));
        const sw = `${hexByte(response[response.length - 2])}${hexByte(response[response.length - 1])}`;
        log(
          `APDU #${index} ${header} (${command.length} B) → SW ${sw} (${response.length} B, ${Date.now() - sentAt}ms)`,
        );
        return response;
      } catch (error) {
        log(`APDU #${index} ${header} failed after ${Date.now() - sentAt}ms`, errorText(error));
        throw error;
      }
    },
    async disconnect() {
      log('disconnecting');
      await NfcManager.cancelTechnologyRequest().catch(() => undefined);
    },
  };

  const tunnel = new ItemSecureTunnel(transport, getRandomBytes);

  try {
    const info = await tunnel.connect();
    log('ITEM kernel selected', { uid: shortUid(info.uid), version: info.version, paired: info.paired });
    if (expectedUid && info.uid !== expectedUid) throw new CardSigningError(i18n.t('common:errors.pass.wrongPass'));
    if (!info.paired) throw new CardSigningError(i18n.t('common:errors.pass.notPaired'));

    const saved = await loadCredential(info.uid);
    log(saved ? 'saved pairing key found' : 'no saved pairing key', { entered: !!enteredPairingKey?.trim() });
    if (!saved && !enteredPairingKey?.trim()) {
      throw new NfiScanError(i18n.t('common:errors.pass.pairingKeyRequired'), 'pairing-key-required');
    }
    let pairingKey: Uint8Array;
    try {
      pairingKey = parsePairingKey(enteredPairingKey?.trim() || saved?.pairingKey || '');
    } catch {
      throw new CardSigningError(i18n.t('common:errors.pass.pairingKeyFormat'));
    }
    try {
      try {
        step('authenticating');
        log('opening secure tunnel');
        await tunnel.open(pairingKey);
        log('secure tunnel open');
      } catch (error) {
        log('secure tunnel failed', errorText(error));
        if (error instanceof NfcError.UserCancel) throw error;
        throw new CardSigningError(i18n.t('common:errors.pass.tunnelFailed'));
      }
      const client = new MicrokernelClient(tunnel);
      let before;
      try {
        before = await client.getDiagnostics();
        log('diagnostics', { ringCount: before.ringCount, currentRing: before.currentRing });
      } catch (error) {
        log('diagnostics failed', errorText(error));
        throw new CardSigningError(i18n.t('common:errors.pass.noDiagnostics'));
      }
      if (before.ringCount < 1) throw new CardSigningError(i18n.t('common:errors.pass.noKeyRing'));
      let publicKey;
      try {
        step('reading-key');
        log('exporting public key');
        publicKey = await client.keyrings.exportPublicKey(before.currentRing);
        log('public key exported', {
          bytes: publicKey.length,
          pinned: saved ? samePublicKey(publicKey, saved.publicKey) : 'first use',
        });
      } catch (error) {
        log('public key export failed', errorText(error));
        const status =
          error instanceof CardError
            ? i18n.t('common:errors.pass.cardStatus', { status: error.message })
            : i18n.t('common:errors.pass.keepStill');
        throw new CardSigningError(`${i18n.t('common:errors.pass.exportFailed')} ${status}`);
      }
      const keyChanged = !!saved && !samePublicKey(publicKey, saved.publicKey);
      // Verify the selected account's key before asking the card to sign anything.
      if (expectedPublicKey && !samePublicKey(publicKey, expectedPublicKey)) {
        throw new CardSigningError(
          'This card has a different active keychain. Select its matching account or activate the expected keychain in a supported card manager.',
        );
      }
      if (keyChanged && !enteredPairingKey?.trim()) {
        throw new NfiScanError(i18n.t('common:errors.pass.keyChanged'), 'key-changed');
      }
      if (digest && digest.length !== 32) throw new CardSigningError(i18n.t('common:errors.pass.digestSize'));
      const challenge = digest ?? (await signingDigest(info.uid, 'sign-in', ''));
      let signature;
      try {
        step('signing');
        log('signing', { what: digest ? 'given digest' : 'sign-in challenge' });
        signature = await client.keyrings.sign(before.currentRing, challenge);
        if (publicKey.length === 65) signature = normalizeP256Signature(signature);
        log('signed', { bytes: signature.length });
      } catch (error) {
        log('signing failed', errorText(error));
        const status =
          error instanceof CardError
            ? i18n.t('common:errors.pass.cardStatus', { status: error.message })
            : i18n.t('common:errors.pass.keepStill');
        throw new CardSigningError(`${i18n.t('common:errors.pass.signFailed')} ${status}`);
      }
      step('verifying');
      const after = await client.getDiagnostics();
      log('diagnostics after signing', { ringCount: after.ringCount, currentRing: after.currentRing });
      if (after.currentRing !== before.currentRing || after.ringCount !== before.ringCount) {
        throw new CardSigningError(i18n.t('common:errors.pass.ringChanged'));
      }
      const verified = verifyCardSignature(signature, challenge, publicKey);
      log(verified ? 'signature verified' : 'signature did not verify');
      if (!verified) {
        throw new CardSigningError(i18n.t('common:errors.pass.notVerified'));
      }
      if (!saved || keyChanged) {
        await saveCredential(info.uid, pairingKey, publicKey);
        log('pairing key and public key saved');
      } else {
        await markPaired(info.uid);
      }
      log('tap succeeded');
      if (Platform.OS === 'ios')
        await NfcManager.setAlertMessageIOS(i18n.t('common:tap.iosVerified')).catch(() => undefined);
      return {
        uid: info.uid,
        publicKey,
        signature,
        ring: before.currentRing,
        ringCount: before.ringCount,
        firmware: String(info.version),
      };
    } finally {
      pairingKey.fill(0);
    }
  } catch (error) {
    if (cancelRequested) {
      log('cancelled from the app');
      return null;
    }
    if (timedOut) {
      throw new NfiScanError(i18n.t('common:errors.nfc.notDetected'));
    }
    if (error instanceof NfcError.UserCancel) {
      log('cancelled by the user');
      return null;
    }
    log('tap failed', errorText(error));
    if (error instanceof NfiScanError) throw error;
    if (error instanceof CardSigningError) throw new NfiScanError(error.message);
    if (error instanceof Error && error.message === 'Not an ITEM application response') {
      throw new NfiScanError(i18n.t('common:errors.nfc.notItem'));
    }
    throw new NfiScanError(i18n.t('common:errors.nfc.failed'));
  } finally {
    await tunnel.close();
    log(`tunnel closed after ${apdus} APDUs`);
  }
}

/** ISO-DEP reader support: `undefined` until known. iOS checks the tag reader session, not NDEF. */
async function checkNfiScanAvailable() {
  try {
    const supported = await NfcManager.isSupported(NfcTech.IsoDep);
    console.log('[nfi] ISO-DEP reader available:', supported);
    return supported;
  } catch {
    console.log('[nfi] ISO-DEP check rejected (no Activity yet); retrying');
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
