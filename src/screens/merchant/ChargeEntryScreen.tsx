import { useNavigation } from '@react-navigation/native';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { MERCHANT_NAME } from '../../constants';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { keypadPressed, selectDraftAmount, type KeypadKey } from '../../store/slices/merchantSlice';
import { cn } from '../../utils/cn';

const KEYPAD_ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

export function ChargeEntryScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const amount = useAppSelector(selectDraftAmount);
  const value = Number(amount);

  return (
    <Screen eyebrow={MERCHANT_NAME.toUpperCase()} title="New charge">
      <View className="mb-[22px] items-center rounded-[10px] bg-brass pb-7 pt-[35px]">
        <AppText className="text-[10px] tracking-[1px] text-[#2d2a0b]">CHARGE AMOUNT</AppText>
        <AppText className="mt-3 font-outfit-semibold text-[50px] leading-[54px] tracking-[-2px] text-[#111]">
          {amount || '0.00'} <AppText className="text-[19px] text-[#2d2a0b]">USDC</AppText>
        </AppText>
      </View>

      <View className="mb-[22px] gap-px bg-[#444]">
        {KEYPAD_ROWS.map((row) => (
          <View key={row.join('')} className="flex-row gap-px">
            {row.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={key === '⌫' ? 'Delete' : key}
                onPress={() => dispatch(keypadPressed(key))}
                className="h-[66px] flex-1 items-center justify-center bg-[#111] active:bg-brass"
              >
                {({ pressed }) => (
                  <AppText className={cn('text-[18px]', pressed && 'text-[#111]')}>{key}</AppText>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <Button
        icon="tap"
        label="Present for tap"
        disabled={!value}
        onPress={() =>
          navigation.navigate('Merchant', {
            screen: 'Charge',
            params: { screen: 'TapToPay', params: { amount: value } },
          })
        }
      />
    </Screen>
  );
}
