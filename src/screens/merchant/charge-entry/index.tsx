import { useNavigation } from '@react-navigation/native';
import { Pressable, View } from 'react-native';

import { AppText } from '../../../components/ui/app-text';
import { Button } from '../../../components/ui/button';
import { ScreenLayout } from '../../../components/layout/screen-layout';
import { MERCHANT_NAME } from '../../../constants';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { keypadPressed, selectDraftAmount, type KeypadKey } from '../../../store/slices/merchant-slice';
import { cn } from '../../../utils/cn';

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
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{MERCHANT_NAME.toUpperCase()}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>New charge</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="mb-5.5 items-center rounded-lg bg-brass pt-8.75 pb-7">
          <AppText className="text-2xs tracking-widest text-[#2d2a0b]">CHARGE AMOUNT</AppText>
          <AppText className="mt-3 font-outfit-semibold text-5xl leading-none tracking-tighter text-[#111]">
            {amount || '0.00'} <AppText className="text-lg text-[#2d2a0b]">USDC</AppText>
          </AppText>
        </View>

        <View className="gap-px bg-[#444]">
          {KEYPAD_ROWS.map((row) => (
            <View key={row.join('')} className="flex-row gap-px">
              {row.map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={key === '⌫' ? 'Delete' : key}
                  onPress={() => dispatch(keypadPressed(key))}
                  className="h-16.5 flex-1 items-center justify-center bg-[#111] active:bg-brass"
                >
                  {({ pressed }) => <AppText className={cn('text-lg', pressed && 'text-[#111]')}>{key}</AppText>}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
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
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
