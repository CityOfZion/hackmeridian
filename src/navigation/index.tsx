import { createStaticNavigation, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LockCardSheet } from '../screens/modals/LockCardSheet';
import { NetworkFreezeSheet } from '../screens/modals/NetworkFreezeSheet';
import { RoleSelectScreen } from '../screens/RoleSelectScreen';
import { colors } from '../theme/colors';
import { BankTabs } from './BankTabs';
import { CardHolderTabs } from './CardHolderTabs';
import { MerchantTabs } from './MerchantTabs';

const RootStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    contentStyle: { backgroundColor: colors.ink },
  },
  screens: {
    RoleSelect: RoleSelectScreen,
    Bank: BankTabs,
    CardHolder: CardHolderTabs,
    Merchant: MerchantTabs,
  },
  groups: {
    Sheets: {
      screenOptions: {
        presentation: 'transparentModal',
        animation: 'fade',
        contentStyle: { backgroundColor: 'transparent' },
      },
      screens: {
        LockCard: LockCardSheet,
        NetworkFreeze: NetworkFreezeSheet,
      },
    },
  },
});

export const navigationTheme: Theme = {
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

export const Navigation = createStaticNavigation(RootStack);

type RootStackType = typeof RootStack;

declare module '@react-navigation/native' {
  interface RootNavigator extends RootStackType {}
}
