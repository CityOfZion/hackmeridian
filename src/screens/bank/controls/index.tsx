import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';

import { SettingRow } from '../../../components/rows/setting-row';
import { AppText, Eyebrow } from '../../../components/ui/app-text';
import { Button } from '../../../components/ui/button';
import { ScreenLayout } from '../../../components/layout/screen-layout';
import { DEFAULT_DAILY_LIMIT, MAX_TRANSACTION } from '../../../constants';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  merchantAcceptanceToggled,
  selectMerchantAcceptance,
  selectNetworkFrozen,
} from '../../../store/slices/network-slice';
import { formatUsdc } from '../../../utils/format';

export function ControlsScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const frozen = useAppSelector(selectNetworkFrozen);
  const merchantAcceptance = useAppSelector(selectMerchantAcceptance);

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>BANK OWNER</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Network controls</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <AppText className="leading-relaxed text-muted">
          Controls synchronize directly with issued secure elements.
        </AppText>
        <SettingRow title="Default daily limit" value={`${formatUsdc(DEFAULT_DAILY_LIMIT)} USDC`} />
        <SettingRow title="Maximum transaction" value={`${formatUsdc(MAX_TRANSACTION)} USDC`} />
        <SettingRow
          title="Merchant acceptance"
          toggle={{ value: merchantAcceptance, onChange: () => dispatch(merchantAcceptanceToggled()) }}
        />

        <View className="mt-7.5 border border-[#563033] bg-[#201517] p-4.5">
          <Eyebrow>EMERGENCY CONTROL</Eyebrow>
          <AppText className="my-2 font-outfit-semibold text-lg">Freeze all cards</AppText>
          <AppText className="mb-4.5 text-xs leading-normal text-[#9a7778]">
            Immediately disables payment across every issued secure element.
          </AppText>
          <Button
            variant="danger"
            label={frozen ? 'Unfreeze network' : 'Initiate network freeze'}
            onPress={() => navigation.navigate('NetworkFreeze')}
          />
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
