import { type BottomTabNavigationOptions, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { Icon, type IconName } from '@/components/ui/icon';
import { CardLockDrawer } from '@/routes/drawers/card/lock';
import { NetworkFreezeDrawer } from '@/routes/drawers/network/freeze';
import { BankCardsDetailsScreen } from '@/routes/screens/bank/cards/details';
import { BankCardsListScreen } from '@/routes/screens/bank/cards/list';
import { BankControlsScreen } from '@/routes/screens/bank/controls';
import { BankIssueFormScreen } from '@/routes/screens/bank/issue/form';
import { BankIssueSuccessScreen } from '@/routes/screens/bank/issue/success';
import { BankOverviewScreen } from '@/routes/screens/bank/overview';
import { CardHolderActivityScreen } from '@/routes/screens/card-holder/activity';
import { CardHolderCardHomeScreen } from '@/routes/screens/card-holder/card/home';
import { CardHolderCardSpendLimitScreen } from '@/routes/screens/card-holder/card/spend-limit';
import { CardHolderDetailsScreen } from '@/routes/screens/card-holder/details';
import { MerchantChargeAmountScreen } from '@/routes/screens/merchant/charge/amount';
import { MerchantChargeResultScreen } from '@/routes/screens/merchant/charge/result';
import { MerchantChargeTapToPayScreen } from '@/routes/screens/merchant/charge/tap-to-pay';
import { MerchantSummaryScreen } from '@/routes/screens/merchant/summary';
import { RoleSelectScreen } from '@/routes/screens/role-select';
import { colors } from '@/theme/colors';

// Route names mirror the folder: '(screens)/bank/cards/details' lives in screens/bank/cards/details/.
// Deep link paths are the same without the group, e.g. vaultpass://bank/cards/details?holderId=liam

const tabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.brass,
  tabBarInactiveTintColor: '#777',
  tabBarStyle: { backgroundColor: colors.ink, borderTopColor: colors.brass },
  tabBarLabelStyle: { fontFamily: 'Outfit_500Medium', fontSize: 10 },
};

// Screens render their own header through <ScreenLayout.Header>
const pageScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.ink },
};

const drawerScreenOptions: NativeStackNavigationOptions = {
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
};

function tabOptions(title: string, icon: IconName): BottomTabNavigationOptions {
  return {
    title,
    tabBarIcon: function TabIcon({ color }) {
      return <Icon name={icon} color={color} size={22} />;
    },
  };
}

function RolesExitPlaceholder() {
  return null;
}

// Last tab of every role: never focuses, pops back to role selection instead
const rolesExitTab = {
  screen: RolesExitPlaceholder,
  linking: null,
  options: tabOptions('Roles', 'logout'),
  listeners: ({
    navigation,
  }: {
    navigation: { dispatch: (action: ReturnType<typeof StackActions.popTo>) => void };
  }) => ({
    tabPress: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      navigation.dispatch(StackActions.popTo('(screens)/role-select'));
    },
  }),
};

// Bank

const bankOverviewStack = createNativeStackNavigator({
  screenOptions: pageScreenOptions,
  screens: {
    '(screens)/bank/overview': { screen: BankOverviewScreen, linking: 'bank/overview' },
  },
});

const bankCardsStack = createNativeStackNavigator({
  screenOptions: pageScreenOptions,
  screens: {
    '(screens)/bank/cards/list': { screen: BankCardsListScreen, linking: 'bank/cards/list' },
    '(screens)/bank/cards/details': { screen: BankCardsDetailsScreen, linking: 'bank/cards/details' },
  },
});

const bankIssueStack = createNativeStackNavigator({
  screenOptions: pageScreenOptions,
  screens: {
    '(screens)/bank/issue/form': { screen: BankIssueFormScreen, linking: 'bank/issue/form' },
    '(screens)/bank/issue/success': {
      screen: BankIssueSuccessScreen,
      linking: 'bank/issue/success',
      options: { gestureEnabled: false },
    },
  },
});

const bankControlsStack = createNativeStackNavigator({
  screenOptions: pageScreenOptions,
  screens: {
    '(screens)/bank/controls': { screen: BankControlsScreen, linking: 'bank/controls' },
  },
});

const bankTabStack = createBottomTabNavigator({
  screenOptions: tabScreenOptions,
  screens: {
    BankOverviewStack: { screen: bankOverviewStack, options: tabOptions('Overview', 'home') },
    BankCardsStack: { screen: bankCardsStack, options: tabOptions('Cards', 'users') },
    BankIssueStack: { screen: bankIssueStack, options: tabOptions('Issue', 'plus') },
    BankControlsStack: { screen: bankControlsStack, options: tabOptions('Controls', 'settings') },
    BankRolesExit: rolesExitTab,
  },
});

// Card Holder

const cardHolderCardStack = createNativeStackNavigator({
  screenOptions: pageScreenOptions,
  screens: {
    '(screens)/card-holder/card/home': { screen: CardHolderCardHomeScreen, linking: 'card-holder/card/home' },
    '(screens)/card-holder/card/spend-limit': {
      screen: CardHolderCardSpendLimitScreen,
      linking: 'card-holder/card/spend-limit',
    },
  },
});

const cardHolderActivityStack = createNativeStackNavigator({
  screenOptions: pageScreenOptions,
  screens: {
    '(screens)/card-holder/activity': { screen: CardHolderActivityScreen, linking: 'card-holder/activity' },
  },
});

const cardHolderDetailsStack = createNativeStackNavigator({
  screenOptions: pageScreenOptions,
  screens: {
    '(screens)/card-holder/details': { screen: CardHolderDetailsScreen, linking: 'card-holder/details' },
  },
});

const cardHolderTabStack = createBottomTabNavigator({
  screenOptions: tabScreenOptions,
  screens: {
    CardHolderCardStack: { screen: cardHolderCardStack, options: tabOptions('Card', 'card') },
    CardHolderActivityStack: { screen: cardHolderActivityStack, options: tabOptions('Activity', 'receipt') },
    CardHolderDetailsStack: { screen: cardHolderDetailsStack, options: tabOptions('Details', 'settings') },
    CardHolderRolesExit: rolesExitTab,
  },
});

// Merchant

const merchantChargeStack = createNativeStackNavigator({
  screenOptions: pageScreenOptions,
  screens: {
    '(screens)/merchant/charge/amount': { screen: MerchantChargeAmountScreen, linking: 'merchant/charge/amount' },
    '(screens)/merchant/charge/tap-to-pay': {
      screen: MerchantChargeTapToPayScreen,
      // URL params arrive as strings
      linking: { path: 'merchant/charge/tap-to-pay', parse: { amount: Number } },
    },
    '(screens)/merchant/charge/result': {
      screen: MerchantChargeResultScreen,
      linking: 'merchant/charge/result',
      options: { gestureEnabled: false },
    },
  },
});

const merchantSummaryStack = createNativeStackNavigator({
  screenOptions: pageScreenOptions,
  screens: {
    '(screens)/merchant/summary': { screen: MerchantSummaryScreen, linking: 'merchant/summary' },
  },
});

const merchantTabStack = createBottomTabNavigator({
  screenOptions: tabScreenOptions,
  screens: {
    MerchantChargeStack: { screen: merchantChargeStack, options: tabOptions('Charge', 'tap') },
    MerchantSummaryStack: { screen: merchantSummaryStack, options: tabOptions('Summary', 'receipt') },
    MerchantRolesExit: rolesExitTab,
  },
});

// Declared last because it nests the role tab stacks: these consts are evaluated at import time
export const stack = createNativeStackNavigator({
  screenOptions: pageScreenOptions,
  groups: {
    screens: {
      screens: {
        '(screens)/role-select': { screen: RoleSelectScreen, linking: '' },
        BankTabStack: bankTabStack,
        CardHolderTabStack: cardHolderTabStack,
        MerchantTabStack: merchantTabStack,
      },
    },
    drawers: {
      screenOptions: drawerScreenOptions,
      screens: {
        '(drawers)/card/lock': { screen: CardLockDrawer, linking: 'card/lock' },
        '(drawers)/network/freeze': { screen: NetworkFreezeDrawer, linking: 'network/freeze' },
      },
    },
  },
});

export type TStackType = typeof stack;

declare module '@react-navigation/native' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RootNavigator extends TStackType {}
}
