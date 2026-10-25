import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '../../utils/cn';
import { AppText } from './AppText';

type Props = TextInputProps & { label: string };

export function FormField({ label, className, ...inputProps }: Props) {
  return (
    <View>
      <AppText className="text-[9px] tracking-[0.9px] text-[#888]">{label}</AppText>
      <TextInput
        placeholderTextColorClassName="accent-[#666]"
        cursorColorClassName="accent-brass"
        selectionColorClassName="accent-brass"
        className={cn('mt-2 h-[49px] border-b border-[#666] font-outfit text-[15px] text-[#eee] focus:border-brass', className)}
        {...inputProps}
      />
    </View>
  );
}
