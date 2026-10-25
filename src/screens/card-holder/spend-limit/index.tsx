import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';
import { withUniwind } from 'uniwind';

import { AppText } from '../../../components/ui/app-text';
import { Button } from '../../../components/ui/button';
import { Icon } from '../../../components/ui/icon';
import { InfoRows } from '../../../components/ui/info-rows';
import { Money } from '../../../components/ui/money';
import { ScreenLayout } from '../../../components/layout/screen-layout';
import { LIMIT_RANGE } from '../../../constants';
import { useCurrentHolder } from '../../../hooks/use-current-holder';
import { useAppDispatch } from '../../../store/hooks';
import { dailyLimitChanged } from '../../../store/slices/holders-slice';
import { colors } from '../../../theme/colors';
import { formatUsdc } from '../../../utils/format';

const StyledSlider = withUniwind(Slider);

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
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>PERSONAL CONTROL</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Daily spend limit</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="items-center border border-line bg-panel px-4.5 py-7">
          <AppText className="text-2xs tracking-widest text-muted">CURRENT DAILY LIMIT</AppText>
          <Money amount={limit} size="xl" className="mb-5.5 mt-3" />
          <StyledSlider
            className="h-10 w-full"
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
            <AppText className="text-3xs text-[#777]">{LIMIT_RANGE.min}</AppText>
            <AppText className="text-3xs text-[#777]">{LIMIT_RANGE.max} USDC</AppText>
          </View>
        </View>

        <InfoRows
          rows={[
            { label: 'SPENT TODAY', value: `${formatUsdc(spentToday)} USDC` },
            { label: 'REMAINING', value: `${formatUsdc(Math.max(0, limit - spentToday))} USDC` },
            { label: 'ENFORCEMENT', value: 'EFFECTIVE IMMEDIATELY' },
          ]}
        />

        <View className="flex-row gap-3">
          <Icon name="card" />
          <AppText className="flex-1 text-xs leading-normal text-muted">
            This limit is signed to your card's secure element. Payments above the remaining limit will be refused by the
            card.
          </AppText>
        </View>
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button label="Save limit" onPress={save} />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
