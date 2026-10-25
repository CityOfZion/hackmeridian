import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ActivityScreen } from '../screens/card-holder/activity';
import { CardDetailsScreen } from '../screens/card-holder/card-details';
import { CardHomeScreen } from '../screens/card-holder/card-home';
import { SpendLimitScreen } from '../screens/card-holder/spend-limit';
import { nestedStackScreenOptions, roleTabsScreenOptions, rolesExitTab, tabIcon } from './role-tabs';

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
