import { useNavigation } from '@react-navigation/native';

import { Button } from '../../../components/ui/button';
import { ResultBadge } from '../../../components/ui/result-badge';
import { Sheet } from '../../../components/ui/sheet';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { freezeToggled, selectNetworkFrozen } from '../../../store/slices/network-slice';

export function NetworkFreezeSheet() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const frozen = useAppSelector(selectNetworkFrozen);

  const confirm = () => {
    dispatch(freezeToggled());
    navigation.goBack();
  };

  return (
    <Sheet
      badge={<ResultBadge icon="lock" tone="brass" round />}
      eyebrow="EMERGENCY CONTROL"
      eyebrowClassName="text-brass"
      title={frozen ? 'Unfreeze the network?' : 'Freeze the network?'}
      body={
        frozen
          ? 'Are you sure you want to restore payment capability across all issued cards?'
          : 'Are you sure you want to initiate a network freeze? Every issued card will be unable to pay.'
      }
    >
      <Button label="Yes" onPress={confirm} />
      <Button variant="inverse" label="No" onPress={() => navigation.goBack()} />
    </Sheet>
  );
}
