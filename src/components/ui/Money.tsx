import { cn } from '../../utils/cn';
import { formatUsdc } from '../../utils/format';
import { AppText } from './AppText';

type Props = {
  amount: number;
  /** Font size of the number in px; the USDC unit renders at ~40% of it. */
  size: number;
  className?: string;
  unitClassName?: string;
};

export function Money({ amount, size, className, unitClassName }: Props) {
  return (
    <AppText className={className} style={{ fontSize: size, lineHeight: size * 1.1 }}>
      {formatUsdc(amount)}{' '}
      <AppText className={cn('text-muted', unitClassName)} style={{ fontSize: Math.round(size * 0.4) }}>
        USDC
      </AppText>
    </AppText>
  );
}
