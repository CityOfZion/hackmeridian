import { useState } from 'react';

import type { TapResult } from '@/api/types';
import { NfiScanError, useScanItemNfi } from '@/hooks/use-item-nfi';
import { apiErrorMessage, useAuthTapMutation } from '@/store/api/vault-api';
import { randomHex } from '@/utils/ids';

let lastCounter = 0;

/** Tap counter, strictly rising across taps like the chip's own counter. */
function nextCounter() {
  lastCounter = Math.max(lastCounter + 1, Date.now());
  return lastCounter;
}

/**
 * Reads the Pass over NFC and verifies the tap with `POST /auth/tap`, returning a single-use tap token. The chip ID is
 * the ITEM application UID; counter and signature are generated here until the applet's signed-tap format is
 * published. `simulateTap` stands in for the chip where there is no NFC reader (development builds only).
 */
export function usePassTap() {
  const { scanItemNfi, isNfiScanAvailable } = useScanItemNfi();
  const [authTap] = useAuthTapMutation();
  const [isTapping, setIsTapping] = useState(false);
  const [error, setError] = useState<string>();

  const verify = async (chipId: string): Promise<TapResult> =>
    authTap({ chipId, counter: nextCounter(), signature: randomHex(64) }).unwrap();

  const run = async (read: () => Promise<string | null>): Promise<TapResult | null> => {
    setError(undefined);
    setIsTapping(true);
    try {
      const chipId = await read();
      return chipId ? await verify(chipId) : null;
    } catch (tapError) {
      setError(tapError instanceof NfiScanError ? tapError.message : apiErrorMessage(tapError));
      return null;
    } finally {
      setIsTapping(false);
    }
  };

  const tapPass = (alertMessage: string) => run(async () => (await scanItemNfi(alertMessage))?.uid ?? null);
  const simulateTap = (chipId: string) => run(async () => chipId);

  return { tapPass, simulateTap, isTapping, error, setError, isNfiScanAvailable };
}
