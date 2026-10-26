import { useState } from 'react';

import { NfiScanError, type PassSignature, useScanItemNfi } from '@/hooks/use-item-nfi';

/**
 * Authenticates the Pass over NFC and has it sign: a fresh challenge to sign in (`tapPass`), or a given digest such
 * as a Stellar transaction hash (`signWithPass`). `simulateTap` stands in for the chip in demos and on devices
 * without an NFC reader.
 */
export function usePassTap() {
  const { scanItemNfi, isNfiScanAvailable } = useScanItemNfi();
  const [isTapping, setIsTapping] = useState(false);
  const [error, setError] = useState<string>();

  const run = async <T>(read: () => Promise<T | null>): Promise<T | null> => {
    setError(undefined);
    setIsTapping(true);
    try {
      return await read();
    } catch (tapError) {
      setError(tapError instanceof NfiScanError ? tapError.message : 'Could not read the Pass. Try again.');
      return null;
    } finally {
      setIsTapping(false);
    }
  };

  /** Sign-in: resolves the Pass's ITEM UID after a verified signature. */
  const tapPass = (alertMessage: string, pairingKey?: string) =>
    run(async () => (await scanItemNfi(alertMessage, { pairingKey }))?.uid ?? null);
  /** Signs exactly `digest` with the Pass `expectedUid`; the signature is verified against its pinned key. */
  const signWithPass = (alertMessage: string, digest: Uint8Array, expectedUid: string) =>
    run<PassSignature>(() => scanItemNfi(alertMessage, { digest, expectedUid }));
  const simulateTap = (chipId: string) => run(async () => chipId);

  return { tapPass, signWithPass, simulateTap, isTapping, error, setError, isNfiScanAvailable };
}
