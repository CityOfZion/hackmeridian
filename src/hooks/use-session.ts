import { StackActions, useNavigation } from '@react-navigation/native';
import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect } from 'react';

import { useGetVaultQuery } from '@/store/api/vault-api';
import { useAppSelector } from '@/store/hooks';
import { selectSession } from '@/store/slices/session-slice';

/**
 * The signed-in session for screens behind sign-in. Without one (a deep link, or after sign-out) it sends the user
 * back to the scan screen; render nothing while `session` is undefined.
 */
export function useRequiredSession() {
  const navigation = useNavigation();
  const session = useAppSelector(selectSession);

  useEffect(() => {
    if (!session) navigation.dispatch(StackActions.replace('(screens)/scan'));
  }, [session, navigation]);

  return session;
}

/** The session's vault and activity; polls so pending withdrawals settle on screen. */
export function useVault(userId: string | undefined) {
  return useGetVaultQuery(userId ? { userId } : skipToken, { pollingInterval: 5000 });
}
