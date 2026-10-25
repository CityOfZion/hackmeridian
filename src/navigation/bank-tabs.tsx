import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ControlsScreen } from '../screens/bank/controls';
import { HolderDetailScreen } from '../screens/bank/holder-detail';
import { HolderListScreen } from '../screens/bank/holder-list';
import { IssueCardScreen } from '../screens/bank/issue-card';
import { IssueSuccessScreen } from '../screens/bank/issue-success';
import { OverviewScreen } from '../screens/bank/overview';
import { nestedStackScreenOptions, roleTabsScreenOptions, rolesExitTab, tabIcon } from './role-tabs';

const CardsStack = createNativeStackNavigator({
  screenOptions: nestedStackScreenOptions,
  screens: {
    HolderList: HolderListScreen,
    HolderDetail: HolderDetailScreen,
  },
});

const IssueStack = createNativeStackNavigator({
  screenOptions: nestedStackScreenOptions,
  screens: {
    IssueCard: IssueCardScreen,
    IssueSuccess: {
      screen: IssueSuccessScreen,
      options: { gestureEnabled: false },
    },
  },
});

export const BankTabs = createBottomTabNavigator({
  screenOptions: roleTabsScreenOptions,
  screens: {
    Overview: {
      screen: OverviewScreen,
      options: { tabBarIcon: tabIcon('home') },
    },
    Cards: {
      screen: CardsStack,
      options: { tabBarIcon: tabIcon('users') },
    },
    Issue: {
      screen: IssueStack,
      options: { tabBarIcon: tabIcon('plus') },
    },
    Controls: {
      screen: ControlsScreen,
      options: { tabBarIcon: tabIcon('settings') },
    },
    Roles: rolesExitTab,
  },
});
