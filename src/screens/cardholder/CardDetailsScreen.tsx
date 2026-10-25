import { Alert } from 'react-native';

import { CardDesignPicker } from '../../components/card/CardDesignPicker';
import { PhysicalCard } from '../../components/card/PhysicalCard';
import { Button } from '../../components/ui/Button';
import { InfoRows } from '../../components/ui/InfoRows';
import { Screen } from '../../components/ui/Screen';
import { FIRMWARE_VERSION } from '../../constants';
import { useCurrentHolder } from '../../hooks/useCurrentHolder';
import { useAppDispatch } from '../../store/hooks';
import { designChanged } from '../../store/slices/holdersSlice';

export function CardDetailsScreen() {
  const dispatch = useAppDispatch();
  const { holder } = useCurrentHolder();

  return (
    <Screen eyebrow="HARDWARE IDENTITY" title="Card details">
      <PhysicalCard state={holder.state} design={holder.design} />
      <CardDesignPicker
        className="mt-[26px]"
        label="SELECT CARD FACE"
        value={holder.design}
        onChange={(design) => dispatch(designChanged({ id: holder.id, design }))}
      />
      <InfoRows
        rows={[
          { label: 'CARD ID', value: holder.cardId },
          { label: 'LIFECYCLE', value: `STATE_${holder.state}` },
          { label: 'BOUND ACCOUNT', value: holder.account },
          { label: 'SECURE ELEMENT', value: 'CERTIFIED · ONLINE' },
          { label: 'FIRMWARE', value: `NFI OS ${FIRMWARE_VERSION}` },
        ]}
      />
      <Button
        variant="secondary"
        label="Request card reissue"
        onPress={() => Alert.alert('Not available', 'This action is not part of the demo yet.')}
      />
    </Screen>
  );
}
