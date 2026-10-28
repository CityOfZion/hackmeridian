import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Muted, Panel, SectionTitle } from '@/components/wallet/primitives';
import { ScreenLayout } from '@/layouts/screen-layout';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectWallet, updateWallet } from '@/store/slices/wallet-slice';
import { validateContact } from '@/wallet/model';

export function WalletContactsScreen() {
  const wallet = useAppSelector(selectWallet);
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const contact = validateContact({ name, address });
      await dispatch(updateWallet({ type: 'contact', contact })).unwrap();
      setName('');
      setAddress('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save contact.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>Wallet</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Contacts</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="gap-5">
          <FormField label="Search contacts" value={search} onChangeText={setSearch} />
          {wallet.contacts
            .filter((c) => `${c.name} ${c.address}`.toLowerCase().includes(search.toLowerCase()))
            .map((contact) => (
              <Panel key={contact.address}>
                <SectionTitle>{contact.name}</SectionTitle>
                <AppText selectable className="text-xs">
                  {contact.address}
                </AppText>
                <View className="flex-row gap-2">
                  <Button
                    className="flex-1"
                    label="Pay"
                    disabled={!wallet.selectedId}
                    onPress={() => navigation.navigate('(screens)/vault/send', { recipient: contact.address })}
                  />
                  <Button
                    className="flex-1"
                    variant="secondary"
                    label="Edit"
                    onPress={() => {
                      setName(contact.name);
                      setAddress(contact.address);
                    }}
                  />
                  <Button
                    className="flex-1"
                    variant="secondary"
                    label="Delete"
                    disabled={busy}
                    onPress={() =>
                      Alert.alert('Delete contact?', contact.name, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await dispatch(
                                updateWallet({ type: 'removeContact', address: contact.address }),
                              ).unwrap();
                            } catch {
                              setError('Could not delete contact.');
                            }
                          },
                        },
                      ])
                    }
                  />
                </View>
              </Panel>
            ))}
          {wallet.contacts.length === 0 && (
            <Muted>
              Save a recipient so you can pay them again. Always verify their full address before the first payment.
            </Muted>
          )}
          <Panel>
            <SectionTitle>
              {wallet.contacts.some((c) => c.address === address) ? 'Edit contact' : 'Add a contact'}
            </SectionTitle>
            <FormField label="Name" value={name} onChangeText={setName} maxLength={40} />
            <FormField
              label="Stellar address"
              value={address}
              onChangeText={setAddress}
              maxLength={56}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Muted>G and C addresses are supported. Memo-required exchange deposits are not supported.</Muted>
            <Button label="Save contact" disabled={busy || !name.trim() || !address.trim()} onPress={save} />
          </Panel>
          {error && (
            <AppText accessibilityRole="alert" className="text-danger">
              {error}
            </AppText>
          )}
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
