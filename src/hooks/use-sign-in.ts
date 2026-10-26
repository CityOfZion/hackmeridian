import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';

import { BiometricError, useBiometricConfirm } from '@/hooks/use-biometric-confirm';
import { cardsApi } from '@/store/api/cards-api';
import { vaultApi } from '@/store/api/vault-api';
import { useAppDispatch } from '@/store/hooks';
import { sessionStarted } from '@/store/slices/session-slice';

/**
 * Finishes a sign-in after a verified tap: Face ID, then the session starts and the stack resets to the dashboard so
 * back can't return to scan. Shared by the scan screen and the pairing-key drawer.
 */
export function useSignIn(onError: (message: string) => void) {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { confirmWithBiometrics } = useBiometricConfirm();
  const [isConfirming, setIsConfirming] = useState(false);

  const signIn = async (chipId: string | null) => {
    if (!chipId) return;
    // Connect to bunq and read the vault while Face ID runs; the dashboard then opens on cached data
    dispatch(cardsApi.util.prefetch('getCards', undefined, {}));
    dispatch(vaultApi.util.prefetch('getVault', chipId, {}));
    setIsConfirming(true);
    try {
      if (!(await confirmWithBiometrics('Sign in to Vault Pass'))) return;
      dispatch(sessionStarted(chipId));
      navigation.reset({ index: 0, routes: [{ name: '(screens)/vault/dashboard' }] });
    } catch (biometricError) {
      onError(biometricError instanceof BiometricError ? biometricError.message : 'Could not confirm it is you.');
    } finally {
      setIsConfirming(false);
    }
  };

  return { signIn, isConfirming };
}
