import type { ReactNode } from 'react';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/colors';

const paths = {
  plus: <Path d="M12 5v14M5 12h14" />,
  check: <Path d="m4 12 5 5L20 6" />,
  back: <Path d="m15 18-6-6 6-6" />,
  logout: <Path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" />,
  tap: <Path d="M8 8a6 6 0 0 1 8 0M5 5a10 10 0 0 1 14 0M11 11a2 2 0 0 1 2 0M12 14v7" />,
  down: <Path d="M12 4v12m-5-5 5 5 5-5M5 20h14" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 20, color = colors.brass }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </Svg>
  );
}
