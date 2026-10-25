import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { InfoRows } from '../../components/ui/InfoRows';
import { Money } from '../../components/ui/Money';
import { Screen } from '../../components/ui/Screen';
import { LIMIT_RANGE } from '../../constants';
import { useCurrentHolder } from '../../hooks/useCurrentHolder';
import { useAppDispatch } from '../../store/hooks';
import { dailyLimitChanged } from '../../store/slices/holdersSlice';
import { colors } from '../../theme/colors';
import { formatUsdc } from '../../utils/format';

export function SpendLimitScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { holder, spentToday } = useCurrentHolder();
  const [limit, setLimit] = useState(holder.dailyLimit);

  const save = () => {
    dispatch(dailyLimitChanged({ id: holder.id, dailyLimit: limit }));
    navigation.goBack();
  };

  return (
    <Screen eyebrow="PERSONAL CONTROL" title="Daily spend limit" canGoBack>
      <View className="items-center border border-line bg-panel px-[18px] py-7">
        <AppText className="text-[10px] tracking-[1px] text-muted">CURRENT DAILY LIMIT</AppText>
        <Money amount={limit} size={34} className="mb-[22px] mt-3" />
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={LIMIT_RANGE.min}
          maximumValue={LIMIT_RANGE.max}
          step={LIMIT_RANGE.step}
          value={limit}
          onValueChange={setLimit}
          minimumTrackTintColor={colors.brass}
          maximumTrackTintColor="#303033"
          thumbTintColor={colors.brass}
          accessibilityLabel="Daily spend limit"
        />
        <View className="w-full flex-row justify-between">
          <AppText className="text-[9px] text-[#777]">{LIMIT_RANGE.min}</AppText>
          <AppText className="text-[9px] text-[#777]">{LIMIT_RANGE.max} USDC</AppText>
        </View>
      </View>

      <InfoRows
        rows={[
          { label: 'SPENT TODAY', value: `${formatUsdc(spentToday)} USDC` },
          { label: 'REMAINING', value: `${formatUsdc(Math.max(0, limit - spentToday))} USDC` },
          { label: 'ENFORCEMENT', value: 'EFFECTIVE IMMEDIATELY' },
        ]}
      />

      <View className="mb-5 flex-row gap-3">
        <Icon name="card" />
        <AppText className="flex-1 text-[11px] leading-[18px] text-muted">
          This limit is signed to your card's secure element. Payments above the remaining limit will be refused by the
          card.
        </AppText>
      </View>
      <Button label="Save limit" onPress={save} />
    </Screen>
  );
}
