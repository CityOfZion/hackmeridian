import { StackActions, useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';

import { useAppSelector } from '@/store/hooks';
import { selectChipId } from '@/store/slices/session-slice';

/**
 * The scanned Pass's chip ID for screens behind the scan. Without one (a deep link, or after sign-out) it sends the
 * user back to the scan screen; render nothing while it is undefined.
 */
export function useRequiredChipId() {
  const navigation = useNavigation();
  const chipId = useAppSelector(selectChipId);

  useEffect(() => {
    if (!chipId) navigation.dispatch(StackActions.replace('(screens)/scan'));
  }, [chipId, navigation]);

  return chipId;
}
