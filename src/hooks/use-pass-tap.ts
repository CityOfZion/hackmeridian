import { useState } from 'react';

import { NfiScanError, type PassSignature, type TapStep, useScanItemNfi } from '@/hooks/use-item-nfi';
import i18n from '@/i18n';
import { accountChallenge, resolveSmartAccount } from '@/api/stellar/smart-account';
import { useAppDispatch } from '@/store/hooks';
import { tapDismissed, tapFailed, tapStarted, tapStepChanged, tapSucceeded } from '@/store/slices/pass-tap-slice';

/**
 * Authenticates the Pass over NFC and has it sign: a server-issued challenge to sign in (`tapPass`), or a given digest
 * such as an OpenZeppelin Soroban authorization digest (`signWithPass`). `simulateTap` stands in for the chip in demos and on devices
 * without an NFC reader.
 */
export function usePassTap() {
  const dispatch = useAppDispatch();
  const { scanItemNfi, isNfiScanAvailable } = useScanItemNfi();
  const [isTapping, setIsTapping] = useState(false);
  const [error, setError] = useState<string>();

  const run = async <T>(
    title: string,
    read: (onStep: (step: TapStep) => void) => Promise<T | null>,
    onPairingKeyRequired?: () => void,
  ): Promise<T | null> => {
    setError(undefined);
    setIsTapping(true);
    dispatch(tapStarted(title));
    try {
      const result = await read((step) => dispatch(tapStepChanged(step)));
      dispatch(result === null ? tapDismissed() : tapSucceeded());
      return result;
    } catch (tapError) {
      if (
        tapError instanceof NfiScanError &&
        (tapError.code === 'pairing-key-required' || tapError.code === 'key-changed') &&
        onPairingKeyRequired
      ) {
        dispatch(tapDismissed());
        onPairingKeyRequired();
        return null;
      }
      const message = tapError instanceof Error ? tapError.message : i18n.t('common:errors.readPass');
      setError(message);
      dispatch(tapFailed(message));
      return null;
    } finally {
      setIsTapping(false);
    }
  };

  /**
   * Sign-in: resolves a card-only mainnet smart account after a verified server challenge.
   * `onPairingKeyRequired` opens re-enrollment when the pairing key is missing or the active key changed.
   */
  const tapPass = (alertMessage: string, pairingKey?: string, onPairingKeyRequired?: () => void) =>
    run(
      alertMessage,
      async (onStep) => {
        const challenge = await accountChallenge();
        const proof = await scanItemNfi(alertMessage, { pairingKey, digest: challenge.digest, onStep });
        if (!proof) return null;
        await resolveSmartAccount(proof, challenge);
        return proof.uid;
      },
      onPairingKeyRequired,
    );
  /** Signs exactly `digest` with the Pass `expectedUid`; the signature is verified against its pinned key. */
  const signWithPass = (alertMessage: string, digest: Uint8Array, expectedUid: string) =>
    run<PassSignature>(alertMessage, (onStep) => scanItemNfi(alertMessage, { digest, expectedUid, onStep }));
  // No modal: nothing is read
  const simulateTap = (chipId: string) => {
    console.log('[nfi] simulated tap (no chip read)');
    return Promise.resolve(chipId);
  };

  return { tapPass, signWithPass, simulateTap, isTapping, error, setError, isNfiScanAvailable };
}
