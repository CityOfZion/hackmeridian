import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { getRandomBytes } from 'expo-crypto';
import { getItemAsync, setItemAsync, deleteItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';
import { type ItemSecureTunnel } from '@item-systems/item/mobile';
import { useCardPin } from '@/components/nfc/card-pin-provider';
import { claimCardAction, journalCardMutations, cardActionTimestamp } from '@/api/item/card-operation';
import { loadCredential } from '@/api/item/card-signing';
import { hex } from '@/api/item/card-crypto';
import { type PinProfile } from '@/api/item/card-auth';
import { DEFAULT_FACTORY_PAIRING_KEY } from '@/api/item/issuer-bootstrap';
import { newAccountPath } from '@/api/item/account-path';
import * as management from '@/api/item/card-management';
import { withNfiSession } from '@/hooks/use-item-nfi';
import { usePassTap } from '@/hooks/use-pass-tap';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectWalletAccount, selectWallet } from '@/store/slices/wallet-slice';
import { ScreenLayout } from '@/layouts/screen-layout';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Choice, Muted, Panel, SectionTitle } from '@/components/wallet/primitives';
import { tapDismissed, tapStarted, tapStepChanged, tapFailed, tapSucceeded } from '@/store/slices/pass-tap-slice';

/** Consume configured cards through the published SDK. No firmware or factory provisioning. */
export function CardWorkspaceScreen() {
  const selected = useAppSelector(selectWalletAccount);
  const wallet = useAppSelector(selectWallet);
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const ask = useCardPin();
  const { tapPass, isTapping, error } = usePassTap();
  const [issuer, setIssuer] = useState(false);
  const [bootstrap, setBootstrap] = useState(true);
  const [uid, setUid] = useState(selected?.cardUid);
  const [profile, setProfile] = useState<PinProfile>();
  const [issuerProfile, setIssuerProfile] = useState<PinProfile>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [journal, setJournal] = useState<string | null>(null);
  const [inspectedAt, setInspectedAt] = useState(0);
  const [master, setMaster] = useState('');
  const [ring, setRing] = useState(String(selected?.ring ?? ''));
  const [name, setName] = useState('Checking');
  const [uri, setUri] = useState('');
  const [keys, setKeys] = useState<Awaited<ReturnType<typeof management.inspectOwnedKeys>>>();
  const locked = busy || isTapping;
  const storage = (id: string) => `item.card-action.${id}`;
  const identify = async () => {
    let release: (() => void) | undefined;
    try {
      release = claimCardAction();
      setBusy(true);
      dispatch(tapStarted('Identify your card'));
      const id = await withNfiSession(
        'Identify your card',
        { discoveryOnly: true, onStep: (s) => dispatch(tapStepChanged(s)) },
        async (_t, info) => info.uid,
      );
      if (id) {
        if (id !== uid) {
          setProfile(undefined);
          setIssuerProfile(undefined);
          setRing('');
        }
        setUid(id);
        setKeys(undefined);
        setMaster('');
        setInspectedAt(0);
        setJournal(await getItemAsync(storage(id)));
        const saved = await loadCredential(id);
        if (saved?.mode === 'pin') setProfile(saved.profile);
        setMessage('Card identified. Enter its PIN to read accounts.');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not identify card.');
    } finally {
      dispatch(tapDismissed());
      release?.();
      setBusy(false);
    }
  };
  const run = async (
    title: string,
    work: (t: ItemSecureTunnel) => Promise<unknown>,
    mutation = false,
    details: object = {},
  ) => {
    if (!uid) return;
    let release: (() => void) | undefined;
    let pin: Awaited<ReturnType<typeof ask>> = null;
    try {
      release = claimCardAction();
      setBusy(true);
      setMessage('');
      if (mutation && (await getItemAsync(storage(uid))))
        throw new Error('Inspect and reconcile the previous action before another change.');
      const saved = await loadCredential(uid);
      if (!(issuer && bootstrap)) {
        pin = await ask({
          title: issuer ? 'Issuer PIN' : title,
          uid,
          profile: issuer ? issuerProfile : (profile ?? (saved?.mode === 'pin' ? saved.profile : undefined)),
        });
        if (!pin) return;
      }
      dispatch(tapStarted(title));
      const result = await withNfiSession(
        title,
        {
          expectedUid: uid,
          ...(issuer && bootstrap ? { pairingKey: DEFAULT_FACTORY_PAIRING_KEY, issuerBootstrap: true } : { pin: pin! }),
          onStep: (s) => dispatch(tapStepChanged(s)),
        },
        async (t) => {
          if (pin) {
            if (issuer) setIssuerProfile({ ...pin.profile });
            else setProfile({ ...pin.profile });
          }
          const guarded = journalCardMutations(t, async () => {
            const record = JSON.stringify({
              action: title,
              at: new Date().toISOString(),
              master,
              existingRings: keys?.rings.map((r) => r.ring),
              ...details,
            });
            await setItemAsync(storage(uid), record, { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
            setJournal(record);
          });
          await work(mutation ? guarded : t);
          if (mutation) {
            await deleteItemAsync(storage(uid));
            setJournal(null);
          } else setInspectedAt(Date.now());
          return true;
        },
      );
      dispatch(result ? tapSucceeded() : tapDismissed());
      if (result) setMessage(`${title} confirmed.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Card action failed.';
      setMessage(m);
      dispatch(tapFailed(m));
    } finally {
      if (pin) pin.password = '';
      release?.();
      setBusy(false);
    }
  };
  const inspect = () =>
    run('Read accounts from card', async (t) => {
      const k = await management.inspectOwnedKeys(t);
      setKeys(k);
      setMaster(k.masters[0] ? String(k.masters[0].slot) : '');
    });
  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>VaultPass</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Manage card</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="gap-4">
          <Choice
            title="My accounts"
            selected={!issuer}
            onPress={() => {
              if (!locked) {
                setIssuer(false);
                setKeys(undefined);
                setMaster('');
              }
            }}
          />
          <Choice
            title="Bank verification settings"
            selected={issuer}
            onPress={() => {
              if (!locked) {
                setIssuer(true);
                setKeys(undefined);
                setMaster('');
              }
            }}
          />
          <Button label="Identify card" disabled={locked} onPress={identify} />
          {uid && <Muted>Card {uid}</Muted>}
          {journal && (
            <Panel>
              <SectionTitle>Check previous action</SectionTitle>
              <Muted>{journal}</Muted>
              <Muted>
                The acknowledgement was lost. Read the card and compare its accounts with this receipt before clearing
                it. Do not repeat account creation.
              </Muted>
              <Button
                label="I inspected and reconciled this action"
                variant="secondary"
                disabled={locked || inspectedAt <= cardActionTimestamp(journal)}
                onPress={async () => {
                  await deleteItemAsync(storage(uid!));
                  setJournal(null);
                }}
              />
            </Panel>
          )}
          {uid && !issuer && (
            <Panel>
              <SectionTitle>Accounts on your card</SectionTitle>
              <Button label="Read accounts from card" disabled={locked} onPress={inspect} />
              {keys?.masters.map((m) => (
                <Choice
                  key={m.slot}
                  title={`Bank-issued key ${m.slot + 1}`}
                  detail={`${m.rings.length} accounts`}
                  selected={master === String(m.slot)}
                  onPress={() => {
                    if (!locked) setMaster(String(m.slot));
                  }}
                />
              ))}
              {keys && !keys.masters.length && (
                <Muted>No owned account master is available. Your card issuer supplies the configured card.</Muted>
              )}
              <FormField label="Account name" value={name} onChangeText={setName} maxLength={40} editable={!locked} />
              <Button
                label={`Create ${name.trim() || 'account'}`}
                disabled={locked || !!journal || !master || !keys?.engines.length || !name.trim()}
                onPress={() => {
                  const path = newAccountPath(getRandomBytes(16));
                  return run(
                    'Create account',
                    async (t) => {
                      const made = await management.deriveAccount(t, Number(master), path, keys!.engines[0]);
                      setRing(String(made.ring));
                      setKeys(await management.inspectOwnedKeys(t));
                    },
                    true,
                    { path: hex(path) },
                  );
                }}
              />
              {keys?.rings.map((r) => (
                <Choice
                  key={r.ring}
                  title={
                    wallet.accounts.find((a) => a.cardUid === uid && a.ring === r.ring)?.name ?? `Account ${r.ring + 1}`
                  }
                  detail={`Bank-issued key ${r.master + 1}`}
                  selected={ring === String(r.ring)}
                  onPress={() => {
                    if (!locked) setRing(String(r.ring));
                  }}
                />
              ))}
              <Button
                label="Open selected account"
                disabled={locked || !!journal || !ring || !name.trim()}
                onPress={async () => {
                  if (
                    await tapPass('Open this account', undefined, undefined, uid, {
                      forcePin: true,
                      allowAccountChange: true,
                      ring: Number(ring),
                      name,
                      pinProfile: profile,
                      expectedPublicKey: keys?.rings.find((r) => r.ring === Number(ring))?.publicKey,
                    })
                  )
                    navigation.reset({ index: 0, routes: [{ name: '(screens)/vault/dashboard' }] });
                }}
              />
              <Muted>Opening an account verifies its card signature and reloads that account’s balances.</Muted>
            </Panel>
          )}
          {uid && issuer && (
            <Panel>
              <SectionTitle>Bank verification link</SectionTitle>
              <Choice
                title="Default factory pairing key"
                selected={bootstrap}
                onPress={() => {
                  if (!locked) setBootstrap(true);
                }}
              />
              <Choice
                title="Issuer PIN"
                selected={!bootstrap}
                onPress={() => {
                  if (!locked) setBootstrap(false);
                }}
              />
              <Muted>
                Use the bundled factory pairing key for bank setup, or the configured issuer PIN. The card enforces its
                existing permissions. Retired factory pairing cannot be reopened by the app.
              </Muted>
              <FormField
                label="Verification host/path ending in ?d="
                value={uri}
                onChangeText={setUri}
                autoCapitalize="none"
                editable={!locked}
              />
              <Button
                label="Update verification link"
                disabled={locked || !!journal || !uri}
                onPress={() =>
                  run('Update bank verification link', (t) => management.setBankUri(t, uri), true, { uri })
                }
              />
            </Panel>
          )}
          {!!(message || error) && (
            <AppText accessibilityRole="alert" className="text-brass">
              {error || message}
            </AppText>
          )}
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
