import { useNavigation } from '@react-navigation/native';

import { Button } from '../../components/ui/Button';
import { ResultBadge } from '../../components/ui/ResultBadge';
import { Sheet } from '../../components/ui/Sheet';
import { useCurrentHolder } from '../../hooks/useCurrentHolder';
import { useAppDispatch } from '../../store/hooks';
import { cardStateChanged } from '../../store/slices/holdersSlice';

export function LockCardSheet() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { holder } = useCurrentHolder();
  const locked = holder.state === 'LOCKED';

  const confirm = () => {
    dispatch(cardStateChanged({ id: holder.id, state: locked ? 'ACTIVE' : 'LOCKED' }));
    navigation.goBack();
  };

  return (
    <Sheet
      badge={<ResultBadge icon="lock" tone={locked ? 'success' : 'danger'} round />}
      eyebrow="SECURE ELEMENT CONTROL"
      title={locked ? 'Unlock your card?' : 'Lock your card?'}
      body={
        locked
          ? 'Payment capability will be restored on the secure chip.'
          : "Your card will refuse to pay — enforced on the card's secure chip, not just in the app."
      }
    >
      <Button label={locked ? 'Confirm unlock' : 'Confirm secure lock'} onPress={confirm} />
      <Button variant="inverse" label="Cancel" onPress={() => navigation.goBack()} />
    </Sheet>
  );
}
