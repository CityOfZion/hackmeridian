import { useState } from 'react';

import { NfiScanError, useScanItemNfi } from '@/hooks/use-item-nfi';

/**
 * Authenticates the Pass over NFC, verifies a fresh card signature, and resolves its ITEM UID.
 * `simulateTap` stands in for the chip in demos and on devices without an NFC reader.
 */
export function usePassTap() {
  const { scanItemNfi, isNfiScanAvailable } = useScanItemNfi();
  const [isTapping, setIsTapping] = useState(false);
  const [error, setError] = useState<string>();

  const run = async (read: () => Promise<string | null>): Promise<string | null> => {
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

  const tapPass = (
    alertMessage: string,
    purpose: 'sign-in' | 'reload',
    payload = '',
    expectedUid?: string,
    pairingKey?: string,
  ) => run(() => scanItemNfi(alertMessage, purpose, payload, expectedUid, pairingKey));
  const simulateTap = (chipId: string) => run(async () => chipId);

  return { tapPass, simulateTap, isTapping, error, setError, isNfiScanAvailable };
}
