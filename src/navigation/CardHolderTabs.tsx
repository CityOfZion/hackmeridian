import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ActivityScreen } from '../screens/cardholder/ActivityScreen';
import { CardDetailsScreen } from '../screens/cardholder/CardDetailsScreen';
import { CardHomeScreen } from '../screens/cardholder/CardHomeScreen';
import { SpendLimitScreen } from '../screens/cardholder/SpendLimitScreen';
import { nestedStackScreenOptions, roleTabsScreenOptions, rolesExitTab, tabIcon } from './roleTabs';

const CardStack = createNativeStackNavigator({
  screenOptions: nestedStackScreenOptions,
  screens: {
    CardHome: CardHomeScreen,
    SpendLimit: SpendLimitScreen,
  },
});

export const CardHolderTabs = createBottomTabNavigator({
  screenOptions: roleTabsScreenOptions,
  screens: {
    Card: {
      screen: CardStack,
      options: { tabBarIcon: tabIcon('card') },
    },
    Activity: {
      screen: ActivityScreen,
      options: { tabBarIcon: tabIcon('receipt') },
    },
    Details: {
      screen: CardDetailsScreen,
      options: { tabBarIcon: tabIcon('settings') },
    },
    Roles: rolesExitTab,
  },
});
