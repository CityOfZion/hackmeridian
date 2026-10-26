import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { cn } from '@/utils/cn';

type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '⌫';

const KEYPAD_ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

const MAX_AMOUNT_LENGTH = 7;

/** Next typed amount after a key press, e.g. "18" + "." → "18."; at most two decimals. */
export function applyKey(amount: string, key: KeypadKey) {
  if (key === '⌫') return amount.slice(0, -1);
  if (key === '.' && amount.includes('.')) return amount;
  if (/\.\d{2}$/.test(amount)) return amount;
  return (amount + key).replace(/^0+(?=\d)/, '').slice(0, MAX_AMOUNT_LENGTH);
}

export function Keypad({ onKeyPress }: { onKeyPress: (key: KeypadKey) => void }) {
  return (
    <View className="gap-px bg-[#444]">
      {KEYPAD_ROWS.map((row) => (
        <View key={row.join('')} className="flex-row gap-px">
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === '⌫' ? 'Delete' : key}
              onPress={() => onKeyPress(key)}
              className="h-16.5 flex-1 items-center justify-center bg-[#111] active:bg-brass"
            >
              {({ pressed }) => <AppText className={cn('text-lg', pressed && 'text-[#111]')}>{key}</AppText>}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
