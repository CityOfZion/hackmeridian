import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/colors';

const paths = {
  bank: <Path d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M12 3 2.5 8h19L12 3Z" />,
  card: (
    <>
      <Rect x="3" y="5" width="18" height="14" rx="2" />
      <Path d="M3 10h18M7 15h3" />
    </>
  ),
  shop: (
    <>
      <Path d="M4 10v10h16V10M3 10l2-6h14l2 6" />
      <Path d="M8 20v-6h8v6M3 10c1 2 3 2 4 0 1 2 3 2 5 0 1 2 3 2 5 0 1 2 3 2 4 0" />
    </>
  ),
  home: <Path d="m3 11 9-8 9 8v10h-6v-7H9v7H3V11Z" />,
  users: (
    <>
      <Circle cx="9" cy="8" r="3" />
      <Path d="M3 20c0-4 2-7 6-7s6 3 6 7M16 5c3 0 4 2 4 4s-1 3-3 3M17 14c3 .5 4 3 4 6" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  settings: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6l-.4-2.5h-4L10 6a8 8 0 0 0-1.5 1L6 6.2 4 9.6 6 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1A8 8 0 0 0 10 18l.5 2.5h4L15 18a8 8 0 0 0 1.5-1l2.4.8 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" />
    </>
  ),
  lock: (
    <>
      <Rect x="5" y="10" width="14" height="11" rx="2" />
      <Path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  receipt: (
    <>
      <Path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <Path d="M9 8h6M9 12h6" />
    </>
  ),
  check: <Path d="m4 12 5 5L20 6" />,
  close: <Path d="m6 6 12 12M18 6 6 18" />,
  arrow: <Path d="m9 18 6-6-6-6" />,
  back: <Path d="m15 18-6-6 6-6" />,
  logout: <Path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" />,
  tap: <Path d="M8 8a6 6 0 0 1 8 0M5 5a10 10 0 0 1 14 0M11 11a2 2 0 0 1 2 0M12 14v7" />,
  search: (
    <>
      <Circle cx="11" cy="11" r="6" />
      <Path d="m20 20-4.5-4.5" />
    </>
  ),
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
