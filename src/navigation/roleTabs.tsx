import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { Icon, type IconName } from '../components/ui/Icon';
import { colors } from '../theme/colors';

/** Shared look for the Bank, Card Holder and Merchant tab bars. */
export const roleTabsScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.brass,
  tabBarInactiveTintColor: '#777',
  tabBarStyle: { backgroundColor: colors.ink, borderTopColor: colors.brass },
  tabBarLabelStyle: { fontFamily: 'Outfit_500Medium', fontSize: 10 },
};

/** Stacks nested inside a tab render their own headers via <Screen>. */
export const nestedStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.ink },
};

export function tabIcon(name: IconName) {
  return ({ color }: { color: string }) => <Icon name={name} color={color} size={22} />;
}

function RolesExitPlaceholder() {
  return null;
}

/** Last tab of every role: never focuses, pops back to role selection instead. */
export const rolesExitTab = {
  screen: RolesExitPlaceholder,
  linking: null,
  options: { title: 'Roles', tabBarIcon: tabIcon('logout') },
  listeners: ({ navigation }: { navigation: { dispatch: (action: ReturnType<typeof StackActions.popTo>) => void } }) => ({
    tabPress: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      navigation.dispatch(StackActions.popTo('RoleSelect'));
    },
  }),
};
