import { Alert } from 'react-native';

import { CardDesignPicker } from '@/components/card/card-design-picker';
import { PhysicalCard } from '@/components/card/physical-card';
import { Button } from '@/components/ui/button';
import { InfoRows } from '@/components/ui/info-rows';
import { ScreenLayout } from '@/layouts/screen-layout';
import { FIRMWARE_VERSION } from '@/constants';
import { useCurrentHolder } from '@/hooks/use-current-holder';
import { useAppDispatch } from '@/store/hooks';
import { designChanged } from '@/store/slices/holders-slice';

export function CardHolderDetailsScreen() {
  const dispatch = useAppDispatch();
  const { holder } = useCurrentHolder();

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>HARDWARE IDENTITY</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Card details</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <PhysicalCard state={holder.state} design={holder.design} />
        <CardDesignPicker
          className="mt-6.5"
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
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
