import { createStaticNavigation, DarkTheme, type Theme } from '@react-navigation/native';
import { createURL } from 'expo-linking';

import { colors } from '@/theme/colors';

import { stack } from './stack';

const Navigation = createStaticNavigation(stack);

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.brass,
    background: colors.ink,
    card: colors.ink,
    text: colors.paper,
    border: colors.line,
  },
};

// Paths come from each screen's `linking` in stack.tsx, e.g. vaultpass://bank/cards/details?holderId=liam
const linking = { enabled: 'auto' as const, prefixes: [createURL('/')] };

export function NavigationRoot() {
  return <Navigation theme={theme} linking={linking} />;
}
