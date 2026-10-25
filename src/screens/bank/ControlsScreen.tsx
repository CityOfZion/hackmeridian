import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';

import { SettingRow } from '../../components/rows/SettingRow';
import { AppText, Eyebrow } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { DEFAULT_DAILY_LIMIT, MAX_TRANSACTION } from '../../constants';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { merchantAcceptanceToggled, selectMerchantAcceptance, selectNetworkFrozen } from '../../store/slices/networkSlice';
import { formatUsdc } from '../../utils/format';

export function ControlsScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const frozen = useAppSelector(selectNetworkFrozen);
  const merchantAcceptance = useAppSelector(selectMerchantAcceptance);

  return (
    <Screen eyebrow="BANK OWNER" title="Network controls">
      <AppText className="leading-[22px] text-muted">Controls synchronize directly with issued secure elements.</AppText>
      <SettingRow title="Default daily limit" value={`${formatUsdc(DEFAULT_DAILY_LIMIT)} USDC`} />
      <SettingRow title="Maximum transaction" value={`${formatUsdc(MAX_TRANSACTION)} USDC`} />
      <SettingRow
        title="Merchant acceptance"
        toggle={{ value: merchantAcceptance, onChange: () => dispatch(merchantAcceptanceToggled()) }}
      />

      <View className="mt-[30px] border border-[#563033] bg-[#201517] p-[18px]">
        <Eyebrow>EMERGENCY CONTROL</Eyebrow>
        <AppText className="my-2 font-outfit-semibold text-[18px]">Freeze all cards</AppText>
        <AppText className="mb-[18px] text-[12px] leading-[18px] text-[#9a7778]">
          Immediately disables payment across every issued secure element.
        </AppText>
        <Button
          variant="danger"
          label={frozen ? 'Unfreeze network' : 'Initiate network freeze'}
          onPress={() => navigation.navigate('NetworkFreeze')}
        />
      </View>
    </Screen>
  );
}
