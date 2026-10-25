import { Text, type TextProps } from 'react-native';

import { cn } from '../../utils/cn';

/** Text with the app font and color applied; RN text does not inherit from parents. */
export function AppText({ className, ...props }: TextProps) {
  return <Text className={cn('font-outfit text-sm text-paper', className)} {...props} />;
}

export function Eyebrow({ className, ...props }: TextProps) {
  return (
    <AppText
      className={cn('font-outfit-semibold text-2xs tracking-widest text-brass uppercase', className)}
      {...props}
    />
  );
}
