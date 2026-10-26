import { useNavigation } from '@react-navigation/native';

import { Button } from '@/components/ui/button';
import { ResultBadge } from '@/components/ui/result-badge';
import { Sheet } from '@/components/ui/sheet';
import { cardsApi } from '@/store/api/cards-api';
import { useAppDispatch } from '@/store/hooks';
import { sessionEnded } from '@/store/slices/session-slice';

export function SessionSignOutDrawer() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const signOut = () => {
    navigation.reset({ index: 0, routes: [{ name: '(screens)/scan' }] });
    dispatch(sessionEnded());
    dispatch(cardsApi.util.resetApiState());
  };

  return (
    <Sheet
      badge={<ResultBadge icon="logout" tone="brass" round />}
      eyebrow="END SESSION"
      title="Sign out?"
      body="Your cards stay in bunq. Scan your Pass to open them again."
    >
      <Button label="Sign out" onPress={signOut} />
      <Button variant="inverse" label="Cancel" onPress={() => navigation.goBack()} />
    </Sheet>
  );
}
