import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChargeEntryScreen } from '../screens/merchant/charge-entry';
import { PaymentResultScreen } from '../screens/merchant/payment-result';
import { SummaryScreen } from '../screens/merchant/summary';
import { TapToPayScreen } from '../screens/merchant/tap-to-pay';
import { nestedStackScreenOptions, roleTabsScreenOptions, rolesExitTab, tabIcon } from './role-tabs';

const ChargeStack = createNativeStackNavigator({
  screenOptions: nestedStackScreenOptions,
  screens: {
    ChargeEntry: ChargeEntryScreen,
    TapToPay: {
      screen: TapToPayScreen,
      // URL params arrive as strings.
      linking: { path: 'tap-to-pay', parse: { amount: Number } },
    },
    PaymentResult: {
      screen: PaymentResultScreen,
      options: { gestureEnabled: false },
    },
  },
});

export const MerchantTabs = createBottomTabNavigator({
  screenOptions: roleTabsScreenOptions,
  screens: {
    Charge: {
      screen: ChargeStack,
      options: { tabBarIcon: tabIcon('tap') },
    },
    Summary: {
      screen: SummaryScreen,
      options: { tabBarIcon: tabIcon('receipt') },
    },
    Roles: rolesExitTab,
  },
});
