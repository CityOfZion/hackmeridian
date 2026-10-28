import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { forgetCredential, loadCredential } from '@/api/item/card-signing';
import { PhysicalCard } from '@/components/card/physical-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Choice, Muted, Panel, SectionTitle } from '@/components/wallet/primitives';
import { usePassTap } from '@/hooks/use-pass-tap';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectWallet, updateWallet } from '@/store/slices/wallet-slice';
import { authenticateDevice } from '@/wallet/device-auth';
import { shortAddress } from '@/wallet/model';

export function WalletCards() {
  const wallet = useAppSelector(selectWallet);
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const [uid, setUid] = useState(
    wallet.accounts.find((a) => a.id === wallet.selectedId)?.cardUid ?? wallet.cards[0]?.uid,
  );
  const card = wallet.cards.find((c) => c.uid === uid);
  const [name, setName] = useState(card?.name ?? '');
  const [paired, setPaired] = useState<boolean>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { tapPass, isTapping, error } = usePassTap();
  useEffect(() => {
    let mounted = true;
    if (uid)
      loadCredential(uid)
        .then((value) => {
          if (mounted) setPaired(!!value);
        })
        .catch(() => {
          if (mounted) setMessage('Could not read this card’s pairing status.');
        });
    return () => {
      mounted = false;
    };
  }, [uid]);
  const rePair = () => navigation.navigate('(drawers)/pass/pairing-key', { expectedUid: uid });
  return (
    <View className="gap-5">
      {wallet.cards.length > 1 &&
        wallet.cards.map((c) => (
          <Choice
            key={c.uid}
            title={c.name}
            detail={shortAddress(c.uid)}
            selected={c.uid === uid}
            onPress={() => {
              if (!busy && !isTapping) {
                setUid(c.uid);
                setName(c.name);
                setMessage(undefined);
              }
            }}
          />
        ))}
      {card && (
        <>
          <PhysicalCard
            design="e"
            caption={{ title: card.name, detail: 'ITEM · P-256' }}
            balance={{ label: 'CARD ID', value: shortAddress(card.uid) }}
          />
          <Muted>
            {Date.parse(card.verifiedAt) > 0
              ? `Last verified ${new Date(card.verifiedAt).toLocaleString()}.`
              : 'Restored from your saved pairing. Tap to refresh card details.'}{' '}
            Card details are a snapshot of the last successful tap.
          </Muted>
          <FormField
            label="Card nickname on this phone"
            value={name}
            onChangeText={setName}
            maxLength={40}
            editable={!busy && !isTapping}
          />
          <Button
            variant="secondary"
            label="Save nickname"
            disabled={!name.trim() || busy || isTapping}
            onPress={async () => {
              setBusy(true);
              try {
                await dispatch(updateWallet({ type: 'renameCard', uid: card.uid, name })).unwrap();
                setMessage('Card name saved.');
              } catch {
                setMessage('Could not save the card name.');
              } finally {
                setBusy(false);
              }
            }}
          />
          <Panel>
            <SectionTitle>Keychains & accounts</SectionTitle>
            {wallet.accounts
              .filter((a) => a.cardUid === uid)
              .map((account) => (
                <Choice
                  key={account.id}
                  title={account.name}
                  selected={wallet.selectedId === account.id}
                  detail={`${shortAddress(account.id)}${account.publicKey === card.publicKey ? ' · Last active on card' : ''}`}
                  onPress={async () => {
                    try {
                      await dispatch(updateWallet({ type: 'select', id: account.id })).unwrap();
                      setMessage(`Now viewing ${account.name}. The physical card is unchanged.`);
                    } catch {
                      setMessage('Could not select this account.');
                    }
                  }}
                />
              ))}
            <Muted>
              Viewing another account does not activate its keychain on the card. This SDK cannot safely switch or
              create a keychain. After using a supported card manager, reconnect the card here to verify and load its
              account.
            </Muted>
            <Button
              label={isTapping ? 'Hold your card still…' : 'Verify card & load active account'}
              icon="tap"
              disabled={isTapping || busy}
              onPress={async () => {
                if (!paired) {
                  rePair();
                  return;
                }
                const result = await tapPass('Verify this card and its active keychain', undefined, rePair, card.uid);
                if (result) {
                  setPaired(true);
                  setMessage('Card verified. Its active account is now selected.');
                }
              }}
            />
          </Panel>
          <Panel>
            <SectionTitle>Card protection</SectionTitle>
            <Muted>
              Freeze and daily spending limits are not supported by this account’s current on-chain policy. Locking this
              app or forgetting a pairing key does not freeze the card.
            </Muted>
            <Button label="Freeze card · unavailable" variant="secondary" disabled />
            <Button label="Daily limits · unavailable" variant="secondary" disabled />
          </Panel>
          <Panel>
            <SectionTitle>Connection & recovery</SectionTitle>
            <Muted>
              {paired === undefined
                ? 'Checking pairing…'
                : paired
                  ? 'Pairing key saved securely on this device.'
                  : 'No pairing key saved. You can view balances; pair again to sign.'}
            </Muted>
            <Button label="Re-pair this card" variant="secondary" disabled={busy || isTapping} onPress={rePair} />
            <Button
              label="Forget pairing key"
              variant="secondary"
              disabled={!paired || busy || isTapping}
              onPress={() =>
                Alert.alert(
                  'Forget this pairing key?',
                  'This removes the connection key from this phone. Your card keys, accounts and funds remain. Keep your pairing key somewhere safe before continuing.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Forget key',
                      style: 'destructive',
                      onPress: async () => {
                        setBusy(true);
                        try {
                          if (wallet.appLock) await authenticateDevice('Forget card pairing');
                          await forgetCredential(card.uid);
                          setPaired(false);
                          setMessage('Pairing key removed. Accounts remain available to view.');
                        } catch (e) {
                          setMessage(e instanceof Error ? e.message : 'Could not forget pairing.');
                        } finally {
                          setBusy(false);
                        }
                      },
                    },
                  ],
                )
              }
            />
            <Muted>
              Lost your Pass? This account has no recovery signer or remote freeze authority. The pairing key cannot
              replace the signing key on the card. Do not remove your connection expecting it to recover funds.
            </Muted>
          </Panel>
          <Panel>
            <SectionTitle>Card details</SectionTitle>
            <Muted>
              Firmware: {card.firmware ?? 'Tap to read'} · Keychain: {card.ring ?? 'Unknown'} · Reported keychains:{' '}
              {card.ringCount ?? 'Unknown'}
            </Muted>
            <Muted>P-256 public key · last verified</Muted>
            <AppText selectable className="text-xs">
              {card.publicKey}
            </AppText>
          </Panel>
        </>
      )}
      {(message || error) && (
        <AppText accessibilityRole="alert" className={error ? 'text-danger' : 'text-brass'}>
          {error ?? message}
        </AppText>
      )}
      <Button
        label="Connect another card"
        disabled={isTapping || busy}
        onPress={() => navigation.navigate('(screens)/scan')}
      />
    </View>
  );
}
