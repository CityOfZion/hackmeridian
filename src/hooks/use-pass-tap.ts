import { useState } from 'react';

import { NfiScanError, useScanItemNfi } from '@/hooks/use-item-nfi';

/**
 * Reads the Pass over NFC and resolves its chip ID (the ITEM application UID), or `null` when the user cancels.
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

  const tapPass = (alertMessage: string) => run(async () => (await scanItemNfi(alertMessage))?.uid ?? null);
  const simulateTap = (chipId: string) => run(async () => chipId);

  return { tapPass, simulateTap, isTapping, error, setError, isNfiScanAvailable };
}
