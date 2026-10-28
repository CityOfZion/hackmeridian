import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Choice, Muted } from '@/components/wallet/primitives';
import { ScreenLayout } from '@/layouts/screen-layout';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectWallet, updateWallet } from '@/store/slices/wallet-slice';
import { shortAddress } from '@/wallet/model';

export function WalletAccountsScreen() {
  const wallet = useAppSelector(selectWallet);
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const [name, setName] = useState(wallet.accounts.find((a) => a.id === wallet.selectedId)?.name ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>Wallet</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Your accounts</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="gap-4">
          <Muted>
            Choose which account to view. This does not change the keychain on your physical card or move any funds.
          </Muted>
          {wallet.accounts.map((account) => (
            <Choice
              key={account.id}
              title={account.name}
              selected={wallet.selectedId === account.id}
              detail={`${wallet.cards.find((c) => c.uid === account.cardUid)?.name} · ${shortAddress(account.id)}`}
              onPress={async () => {
                if (busy) return;
                setBusy(true);
                setError(undefined);
                try {
                  await dispatch(updateWallet({ type: 'select', id: account.id })).unwrap();
                  navigation.reset({ index: 0, routes: [{ name: '(screens)/vault/dashboard' }] });
                } catch {
                  setError('Could not switch the viewed account.');
                } finally {
                  setBusy(false);
                }
              }}
            />
          ))}
          {wallet.selectedId && (
            <>
              <FormField label="Rename the selected account" value={name} maxLength={40} onChangeText={setName} />
              <Button
                label="Save account name"
                disabled={!name.trim() || busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await dispatch(updateWallet({ type: 'renameAccount', id: wallet.selectedId!, name })).unwrap();
                    navigation.goBack();
                  } catch {
                    setError('Could not save the name.');
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          )}
          {error && <AppText className="text-danger">{error}</AppText>}
          <Button
            label="Connect another card or keychain"
            variant="secondary"
            onPress={() => navigation.navigate('(screens)/scan')}
          />
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
