import { Pressable } from 'react-native';

import { colors } from '@/theme/colors';
import { cn } from '@/utils/cn';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'inverse';

const variants: Record<Variant, { container: string; label: string; icon: string }> = {
  primary: { container: 'bg-brass border-brass', label: 'text-[#111]', icon: '#111' },
  secondary: { container: 'bg-transparent border-[#666]', label: 'text-paper', icon: colors.paper },
  danger: { container: 'bg-[#2a1718] border-[#5b3032]', label: 'text-[#d98888]', icon: '#d98888' },
  // Outlined button for light surfaces (sheets).
  inverse: { container: 'bg-transparent border-black', label: 'text-black', icon: '#000' },
};

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  className?: string;
};

export function Button({ label, onPress, variant = 'primary', icon, disabled = false, className }: Props) {
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'min-h-12 flex-row items-center justify-center gap-2 rounded-full border px-4 active:opacity-75 disabled:opacity-35',
        v.container,
        className,
      )}
    >
      {icon && <Icon name={icon} color={v.icon} />}
      <AppText className={cn('font-outfit-semibold text-sm', v.label)}>{label}</AppText>
    </Pressable>
  );
}
