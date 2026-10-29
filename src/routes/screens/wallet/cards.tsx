import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';
import { PhysicalCard } from '@/components/card/physical-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Choice, Muted, Panel, SectionTitle } from '@/components/wallet/primitives';
import { usePassTap } from '@/hooks/use-pass-tap';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectWallet, updateWallet } from '@/store/slices/wallet-slice';
import { AccountProtection } from '@/components/wallet/account-protection';
import { CardSecurity } from '@/components/nfc/card-security';
import { accountSigners, shortAddress } from '@/wallet/model';

export function WalletCards() {
  const wallet = useAppSelector(selectWallet);
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const [uid, setUid] = useState(
    wallet.accounts.find((a) => a.id === wallet.selectedId)?.cardUid ?? wallet.cards[0]?.uid,
  );
  const card = wallet.cards.find((c) => c.uid === uid);
  const [name, setName] = useState(card?.name ?? '');
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { tapPass, isTapping, error } = usePassTap();
  const rePair = () => navigation.navigate('(drawers)/pass/pairing-key', { expectedUid: uid });
  return (
    <View className="gap-5">
      <Button
        label="Manage card"
        disabled={busy || isTapping}
        onPress={() => navigation.navigate('(screens)/wallet/card-workspace')}
      />
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
              .filter((a) => accountSigners(a).some((s) => s.cardUid === uid))
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
              Payments address the selected account’s keychain directly. Manage your card to create accounts. Choose
              which card approves payments in Your accounts.
            </Muted>
            <Button
              label={isTapping ? 'Hold your card still…' : 'Verify card & load active account'}
              icon="tap"
              disabled={isTapping || busy}
              onPress={async () => {
                const result = await tapPass('Verify this card and its active keychain', undefined, rePair, card.uid, {
                  allowAccountChange: true,
                });
                if (result) {
                  setMessage('Card verified. Its active account is now selected.');
                }
              }}
            />
          </Panel>
          {wallet.accounts
            .filter((a) => a.id === wallet.selectedId)
            .map((a) => (
              <AccountProtection key={a.id} account={a} />
            ))}
          <CardSecurity key={card.uid} uid={card.uid} appLock={wallet.appLock} onLegacy={rePair} />
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
