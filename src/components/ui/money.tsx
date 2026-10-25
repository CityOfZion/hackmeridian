import { cn } from '../../utils/cn';
import { formatUsdc } from '../../utils/format';
import { AppText } from './app-text';

// The USDC unit renders at ~40% of the amount.
const sizes = {
  md: { amount: 'text-2xl', unit: 'text-2xs' },
  lg: { amount: 'text-3xl', unit: 'text-xs' },
  xl: { amount: 'text-4xl', unit: 'text-sm' },
  '2xl': { amount: 'text-5xl', unit: 'text-lg' },
} as const;

type Props = {
  amount: number;
  size: keyof typeof sizes;
  className?: string;
  unitClassName?: string;
};

export function Money({ amount, size, className, unitClassName }: Props) {
  return (
    <AppText className={cn(sizes[size].amount, 'leading-tight', className)}>
      {formatUsdc(amount)} <AppText className={cn(sizes[size].unit, 'text-muted', unitClassName)}>USDC</AppText>
    </AppText>
  );
}
