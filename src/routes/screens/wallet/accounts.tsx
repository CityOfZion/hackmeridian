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
import { accountSigners, shortAddress } from '@/wallet/model';

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
          {wallet.accounts
            .filter((a) => a.id === wallet.selectedId)
            .map((account) => (
              <View key={account.id} className="gap-3">
                <AppText>Cards for this account</AppText>
                {accountSigners(account).map((signer) => (
                  <Choice
                    key={signer.publicKey}
                    title={wallet.cards.find((c) => c.uid === signer.cardUid)?.name ?? 'Card'}
                    detail={`Keychain ${signer.ring ?? '?'} · ${shortAddress(signer.publicKey)}`}
                    selected={account.publicKey === signer.publicKey}
                    onPress={async () => {
                      if (busy) return;
                      setBusy(true);
                      try {
                        await dispatch(
                          updateWallet({ type: 'selectSigner', id: account.id, publicKey: signer.publicKey }),
                        ).unwrap();
                      } catch {
                        setError('Could not select this card.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                ))}
                <Button
                  label="Add backup card"
                  disabled={busy}
                  onPress={() => navigation.navigate('(screens)/wallet/backup')}
                />
              </View>
            ))}
          {error && <AppText className="text-danger">{error}</AppText>}
          <Button
            label="Create account on your card"
            onPress={() => navigation.navigate('(screens)/wallet/card-workspace')}
          />
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
