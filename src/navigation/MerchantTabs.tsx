import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChargeEntryScreen } from '../screens/merchant/ChargeEntryScreen';
import { PaymentResultScreen } from '../screens/merchant/PaymentResultScreen';
import { SummaryScreen } from '../screens/merchant/SummaryScreen';
import { TapToPayScreen } from '../screens/merchant/TapToPayScreen';
import { nestedStackScreenOptions, roleTabsScreenOptions, rolesExitTab, tabIcon } from './roleTabs';

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
