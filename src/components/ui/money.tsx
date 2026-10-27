import { cn } from '@/utils/cn';
import { formatAmount } from '@/utils/format';
import { AppText } from './app-text';

// The asset unit renders at ~40% of the amount.
const sizes = {
  lg: { amount: 'text-3xl', unit: 'text-xs' },
  xl: { amount: 'text-4xl', unit: 'text-sm' },
  '2xl': { amount: 'text-5xl', unit: 'text-lg' },
} as const;

type Props = {
  amount: number;
  size: keyof typeof sizes;
  /** Asset code shown after the amount, e.g. `USDC` (vault) or `EURC` (cards). */
  unit: string;
  className?: string;
};

export function Money({ amount, size, unit, className }: Props) {
  return (
    <AppText className={cn(sizes[size].amount, 'leading-tight', className)}>
      {formatAmount(amount)} <AppText className={cn(sizes[size].unit, 'text-muted')}>{unit}</AppText>
    </AppText>
  );
}
