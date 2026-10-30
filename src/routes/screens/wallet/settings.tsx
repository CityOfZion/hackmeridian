import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Muted, Panel, SectionTitle } from '@/components/wallet/primitives';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectWallet, updateWallet, walletLocked } from '@/store/slices/wallet-slice';
import { cardPinSession } from '@/api/item/pin-session';
import { authenticateDevice } from '@/wallet/device-auth';

export function WalletSettings() {
  const wallet = useAppSelector(selectWallet);
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <View className="gap-5">
      <Button
        label="Switch role"
        variant="secondary"
        onPress={() => {
          cardPinSession.clear();
          navigation.reset({ index: 0, routes: [{ name: '(screens)/welcome' }] });
        }}
      />
      <Panel>
        <SectionTitle>Device privacy</SectionTitle>
        <Muted>
          App lock protects access on this phone with biometrics or your device passcode. Your card is still required to
          approve payments.
        </Muted>
        <Button
          label={wallet.appLock ? 'Turn off app lock' : 'Enable app lock'}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setError(undefined);
            try {
              await authenticateDevice('Change VaultPass app lock');
              await dispatch(updateWallet({ type: 'privacy', appLock: !wallet.appLock })).unwrap();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not change app lock.');
            } finally {
              setBusy(false);
            }
          }}
        />
        {wallet.appLock && <Button label="Lock now" variant="secondary" onPress={() => dispatch(walletLocked())} />}
        <Muted>When enabled, the app locks after it goes into the background and on restart.</Muted>
      </Panel>
      <Panel>
        <SectionTitle>Your wallet</SectionTitle>
        <Button
          label="Manage contacts"
          variant="secondary"
          onPress={() => navigation.navigate('(screens)/wallet/contacts')}
        />
        <Button
          label="Manage accounts"
          variant="secondary"
          onPress={() => navigation.navigate('(screens)/wallet/accounts')}
        />
        <Button
          label="Language"
          variant="secondary"
          onPress={() => navigation.navigate('(drawers)/settings/language')}
        />
      </Panel>
      <Panel>
        <SectionTitle>Network & custody</SectionTitle>
        <Muted>
          Stellar Mainnet. P-256 approvals stay on your ITEM card. The relay sponsors network fees and cannot sign for
          your account.
        </Muted>
        <Muted>
          Account names, contacts and payment history are stored on this phone. Pairing keys and pending payment
          signatures use the device’s secure storage. There is no cloud backup. Add a backup card for independent
          account access.
        </Muted>
      </Panel>
      {error && (
        <AppText accessibilityRole="alert" className="text-danger">
          {error}
        </AppText>
      )}
    </View>
  );
}
