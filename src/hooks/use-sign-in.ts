import { useNavigation } from '@react-navigation/native';

import { vaultApi } from '@/store/api/vault-api';
import { useAppDispatch } from '@/store/hooks';
import { sessionStarted } from '@/store/slices/session-slice';

/**
 * Finishes a sign-in after a verified tap: the session starts and the stack resets to the dashboard so back can't
 * return to scan. Shared by the scan screen and the pairing-key drawer.
 */
export function useSignIn() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const signIn = (chipId: string | null) => {
    if (!chipId) return;
    // The card proof has already resolved the P-256 smart account on the backend.
    dispatch(vaultApi.util.prefetch('getVault', chipId, {}));
    dispatch(sessionStarted(chipId));
    navigation.reset({ index: 0, routes: [{ name: '(screens)/vault/dashboard' }] });
  };

  return { signIn };
}
