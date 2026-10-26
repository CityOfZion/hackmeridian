import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { PassPairingKeyDrawer } from '@/routes/drawers/pass/pairing-key';
import { SessionSignOutDrawer } from '@/routes/drawers/session/sign-out';
import { CardsCreateScreen } from '@/routes/screens/cards/create';
import { ScanScreen } from '@/routes/screens/scan';
import { VaultConfirmScreen } from '@/routes/screens/vault/confirm';
import { VaultDashboardScreen } from '@/routes/screens/vault/dashboard';
import { VaultFundScreen } from '@/routes/screens/vault/fund';
import { VaultResultScreen } from '@/routes/screens/vault/result';
import { colors } from '@/theme/colors';

// Route names mirror the folder: '(screens)/vault/confirm' lives in screens/vault/confirm/.
// Deep link paths are the same without the group, e.g. vaultpass://vault/fund?cardId=…

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

export const stack = createNativeStackNavigator({
  screenOptions: pageScreenOptions,
  groups: {
    screens: {
      screens: {
        '(screens)/scan': { screen: ScanScreen, linking: '' },
        '(screens)/vault/dashboard': { screen: VaultDashboardScreen, linking: 'vault/dashboard' },
        '(screens)/vault/fund': { screen: VaultFundScreen, linking: 'vault/fund' },
        '(screens)/cards/create': { screen: CardsCreateScreen, linking: 'cards/create' },
        '(screens)/vault/confirm': {
          screen: VaultConfirmScreen,
          // URL params arrive as strings
          linking: { path: 'vault/confirm', parse: { amount: Number } },
        },
        '(screens)/vault/result': {
          screen: VaultResultScreen,
          linking: 'vault/result',
          options: { gestureEnabled: false },
        },
      },
    },
    drawers: {
      screenOptions: drawerScreenOptions,
      screens: {
        '(drawers)/session/sign-out': { screen: SessionSignOutDrawer, linking: 'session/sign-out' },
        '(drawers)/pass/pairing-key': { screen: PassPairingKeyDrawer, linking: 'pass/pairing-key' },
      },
    },
  },
});

export type TStackType = typeof stack;

declare module '@react-navigation/native' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RootNavigator extends TStackType {}
}
