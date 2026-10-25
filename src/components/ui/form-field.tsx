import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '../../utils/cn';
import { AppText } from './app-text';

type Props = TextInputProps & { label: string };

export function FormField({ label, className, ...inputProps }: Props) {
  return (
    <View>
      <AppText className="text-3xs tracking-widest text-[#888]">{label}</AppText>
      <TextInput
        placeholderTextColorClassName="accent-[#666]"
        cursorColorClassName="accent-brass"
        selectionColorClassName="accent-brass"
        className={cn(
          'mt-2 h-12.25 border-b border-[#666] font-outfit text-base text-[#eee] focus:border-brass',
          className,
        )}
        {...inputProps}
      />
    </View>
  );
}
