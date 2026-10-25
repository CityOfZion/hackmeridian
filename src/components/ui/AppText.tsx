import { Text, type TextProps } from 'react-native';

import { cn } from '../../utils/cn';

/** Text with the app font and color applied; RN text does not inherit from parents. */
export function AppText({ className, ...props }: TextProps) {
  return <Text className={cn('font-outfit text-[14px] text-paper', className)} {...props} />;
}

export function Eyebrow({ className, ...props }: TextProps) {
  return (
    <AppText
      className={cn('font-outfit-semibold text-[10px] uppercase tracking-[1.2px] text-brass', className)}
      {...props}
    />
  );
}
