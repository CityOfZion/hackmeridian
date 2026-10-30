import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { CardsRemoveDrawer } from '@/routes/drawers/cards/remove';
import { PassPairingKeyDrawer } from '@/routes/drawers/pass/pairing-key';
import { SessionSignOutDrawer } from '@/routes/drawers/session/sign-out';
import { SettingsLanguageDrawer } from '@/routes/drawers/settings/language';
import { CardsCreateScreen } from '@/routes/screens/cards/create';
import { ScanScreen } from '@/routes/screens/scan';
import { VaultConfirmScreen } from '@/routes/screens/vault/confirm';
import { VaultDashboardScreen } from '@/routes/screens/vault/dashboard';
import { VaultFundScreen } from '@/routes/screens/vault/fund';
import { VaultSendScreen } from '@/routes/screens/vault/send';
import { VaultResultScreen } from '@/routes/screens/vault/result';
import { WelcomeScreen } from '@/routes/screens/welcome';
import { BankScreen } from '@/routes/screens/bank';
import { colors } from '@/theme/colors';
import { CardWorkspaceScreen, BankConfigureScreen, BankEditScreen } from '@/routes/screens/wallet/card-workspace';
import { WalletBackupScreen } from '@/routes/screens/wallet/backup';
import { WalletAccountsScreen } from '@/routes/screens/wallet/accounts';
import { WalletReceiveScreen } from '@/routes/screens/wallet/receive';
import { WalletContactsScreen } from '@/routes/screens/wallet/contacts';

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
  initialRouteName: '(screens)/welcome',
  screenOptions: pageScreenOptions,
  groups: {
    screens: {
      screens: {
        '(screens)/welcome': { screen: WelcomeScreen, linking: '' },
        '(screens)/bank': { screen: BankScreen, linking: 'bank' },
        '(screens)/bank/configure': { screen: BankConfigureScreen, linking: 'bank/configure' },
        '(screens)/bank/edit': { screen: BankEditScreen, linking: 'bank/edit' },
        '(screens)/scan': { screen: ScanScreen, linking: 'scan' },
        '(screens)/vault/dashboard': { screen: VaultDashboardScreen, linking: 'vault/dashboard' },
        '(screens)/vault/send': { screen: VaultSendScreen, linking: 'pay' },
        '(screens)/wallet/card-workspace': { screen: CardWorkspaceScreen, linking: 'wallet/card' },
        '(screens)/wallet/backup': { screen: WalletBackupScreen, linking: 'wallet/backup' },
        '(screens)/wallet/accounts': { screen: WalletAccountsScreen, linking: 'wallet/accounts' },
        '(screens)/wallet/receive': { screen: WalletReceiveScreen, linking: 'wallet/receive' },
        '(screens)/wallet/contacts': { screen: WalletContactsScreen, linking: 'wallet/contacts' },
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
        '(drawers)/settings/language': { screen: SettingsLanguageDrawer, linking: 'settings/language' },
        '(drawers)/cards/remove': { screen: CardsRemoveDrawer, linking: 'cards/remove' },
      },
    },
  },
});

export type TStackType = typeof stack;

declare module '@react-navigation/native' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RootNavigator extends TStackType {}
}
