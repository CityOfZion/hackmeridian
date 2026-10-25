import { createStaticNavigation, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LockCardSheet } from '../screens/modals/lock-card';
import { NetworkFreezeSheet } from '../screens/modals/network-freeze';
import { RoleSelectScreen } from '../screens/role-select';
import { colors } from '../theme/colors';
import { BankTabs } from './bank-tabs';
import { CardHolderTabs } from './card-holder-tabs';
import { MerchantTabs } from './merchant-tabs';

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
