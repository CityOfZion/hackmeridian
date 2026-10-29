import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { getRandomBytes } from 'expo-crypto';
import { getItemAsync, setItemAsync, deleteItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';
import { type ItemSecureTunnel } from '@item-systems/item/mobile';
import { BankIssuance } from '@/components/nfc/bank-issuance';
import { CardSetupProgress } from '@/components/nfc/card-setup-progress';
import { CardAccountGuide, type AccountGuideMode } from '@/components/nfc/card-account-guide';
import { cardSetupStep, selectedCardRing } from '@/wallet/card-setup';
import { issuanceStorageKey, issuanceBlocksChanges, type Issuance } from '@/api/item/card-issuance';
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

/** Card issuance and account management through the published SDK; no firmware installation. */
export function CardWorkspaceScreen() {
  const selected = useAppSelector(selectWalletAccount);
  const wallet = useAppSelector(selectWallet);
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const ask = useCardPin();
  const { tapPass, isTapping, error, setError: setTapError } = usePassTap();
  const [issuer, setIssuer] = useState(false);
  const [identified, setIdentified] = useState(false);
  const [readVersion, setReadVersion] = useState(0);
  const [activation, setActivation] = useState<Issuance | null>();
  const [existingPersonalPin, setExistingPersonalPin] = useState(false);
  const [masterReviewed, setMasterReviewed] = useState(false);
  const [accountMode, setAccountMode] = useState<AccountGuideMode>('select');
  const [bootstrap, setBootstrap] = useState(false);
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
  const step = cardSetupStep({
    identified,
    activationLoaded: activation !== undefined,
    activationComplete: activation?.phase === 'complete',
    activationPending: !!activation && activation.phase !== 'complete',
    existingPersonalPin,
    masterReviewed,
  });
  const accountName = (value: number) =>
    wallet.accounts.find((a) => a.cardUid === uid && a.ring === value)?.name ?? `Account ${value + 1}`;
  const changeMode = (bank: boolean) => {
    if (locked) return;
    setTapError(undefined);
    setIssuer(bank);
    setKeys(undefined);
    setMaster('');
    setMasterReviewed(false);
    setAccountMode('select');
    setMessage('');
  };
  const storage = (id: string) => `item.card-action.${id}`;
  const identify = async () => {
    let release: (() => void) | undefined;
    try {
      release = claimCardAction();
      setBusy(true);
      setTapError(undefined);
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
        setIdentified(true);
        setActivation(undefined);
        setReadVersion((v) => v + 1);
        setMasterReviewed(false);
        setAccountMode('select');
        setKeys(undefined);
        setMaster('');
        setInspectedAt(0);
        setJournal(await getItemAsync(storage(id)));
        const saved = await loadCredential(id);
        if (saved?.mode === 'pin') setProfile(saved.profile);
        setExistingPersonalPin(saved?.mode === 'pin' && !saved.change);
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
      setTapError(undefined);
      if (mutation && issuanceBlocksChanges(await getItemAsync(issuanceStorageKey(uid)), uid))
        throw new Error('Finish card issuance and verify cardholder ownership before another change.');
      if (mutation && (await getItemAsync(storage(uid))))
        throw new Error('Inspect and reconcile the previous action before another change.');
      const saved = await loadCredential(uid);
      if (!(issuer && bootstrap)) {
        pin = await ask({
          title: issuer ? 'Issuer PIN' : title,
          defaults: issuer
            ? 'issuer'
            : existingPersonalPin || activation?.phase === 'complete'
              ? 'personal'
              : undefined,
          editProfile: !issuer,
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
      return !!result;
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
      setRing('');
      setMasterReviewed(false);
      setAccountMode('select');
    });
  const createAccount = async () => {
    if (
      step !== 4 ||
      accountMode !== 'review' ||
      !keys?.masters.some((m) => String(m.slot) === master) ||
      !keys.engines.length
    )
      return;
    const path = newAccountPath(getRandomBytes(16));
    const done = await run(
      'Create account',
      async (t) => {
        const made = await management.deriveAccount(t, Number(master), path, keys.engines[0]);
        setRing(String(made.ring));
        setKeys(await management.inspectOwnedKeys(t));
      },
      true,
      { path: hex(path) },
    );
    if (done) setAccountMode('created');
  };
  const openAccount = async () => {
    const selectedRing = selectedCardRing(keys?.rings, master, ring);
    if (!uid || !selectedRing || !!journal || step !== 4) return;
    try {
      if (issuanceBlocksChanges(await getItemAsync(issuanceStorageKey(uid)), uid)) {
        setMessage('Finish PIN setup before opening an account.');
        return;
      }
    } catch {
      setMessage('Could not verify card setup. Check the activation details.');
      return;
    }
    if (
      await tapPass('Open this account', undefined, undefined, uid, {
        forcePin: true,
        allowAccountChange: true,
        ring: selectedRing.ring,
        name: accountMode === 'created' ? name.trim() : accountName(selectedRing.ring),
        pinProfile: profile,
        expectedPublicKey: selectedRing.publicKey,
      })
    )
      navigation.reset({ index: 0, routes: [{ name: '(screens)/vault/dashboard' }] });
  };
  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>VaultPass</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{issuer ? 'Manage card' : 'Your card & accounts'}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="gap-4">
          {issuer ? (
            <>
              <Choice title="My accounts" selected={false} onPress={() => changeMode(false)} />
              <Choice title="Bank issuance & settings" selected onPress={() => changeMode(true)} />
              <Button label="Identify card" disabled={locked} onPress={identify} />
              {uid && <Muted>Card {uid}</Muted>}
            </>
          ) : (
            <>
              <CardSetupProgress step={step} />
              {step === 1 ? (
                <Panel>
                  <SectionTitle>Let’s connect your card</SectionTitle>
                  <Muted>
                    We will walk you through your PIN, the masterkeys on your card, and the account you want to use.
                  </Muted>
                  <Muted>
                    Hold your card against your phone’s NFC antenna. This first tap only identifies the card.
                  </Muted>
                  <Button label="Connect my card" disabled={locked} onPress={identify} />
                </Panel>
              ) : (
                <Muted>
                  Connected card · {uid?.slice(0, 6)}…{uid?.slice(-4)}
                </Muted>
              )}
            </>
          )}
          {!issuer && !!(message || error) && (
            <AppText accessibilityRole="alert" className="text-brass">
              {error || message}
            </AppText>
          )}
          {journal && (
            <Panel>
              <SectionTitle>Check previous action</SectionTitle>
              <Muted>{journal}</Muted>
              <Muted>
                The acknowledgement was lost. Read the card and compare its accounts with this receipt before clearing
                it. Do not repeat account creation.
              </Muted>
              {!issuer && <Button label="Read card to check this action" disabled={locked} onPress={inspect} />}
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
          {uid && issuer && (
            <Panel>
              <SectionTitle>Bank access</SectionTitle>
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
            </Panel>
          )}
          {uid && (issuer || identified) && (
            <View style={!issuer && step !== 2 ? { display: 'none' } : undefined}>
              <BankIssuance
                key={`${uid}:${readVersion}`}
                uid={uid}
                issuer={issuer}
                bootstrap={bootstrap}
                issuerProfile={issuerProfile}
                locked={locked}
                onBusy={setBusy}
                onIssuerProfile={setIssuerProfile}
                onHolderProfile={setProfile}
                onRecord={setActivation}
              />
            </View>
          )}
          {!issuer && step === 2 && activation === null && (
            <Button
              label="I already have a personal PIN"
              variant="secondary"
              disabled={locked}
              onPress={() => {
                setExistingPersonalPin(true);
                setMessage('Enter your personal PIN on the next tap to review your masterkeys.');
              }}
            />
          )}
          {!issuer && (step === 3 || step === 4) && (
            <CardAccountGuide
              step={step}
              keys={keys}
              master={master}
              ring={ring}
              name={name}
              mode={accountMode}
              locked={locked || (step === 4 && !!journal)}
              onInspect={inspect}
              onMaster={(value) => {
                setMaster(value);
                setRing('');
                setAccountMode('select');
              }}
              onContinue={() => {
                setMasterReviewed(true);
                setMessage('');
              }}
              onBack={() => {
                setMasterReviewed(false);
                setMessage('');
              }}
              onRing={setRing}
              onName={setName}
              onMode={setAccountMode}
              onCreate={createAccount}
              onOpen={openAccount}
              accountName={accountName}
            />
          )}
          {!issuer && step > 1 && (
            <Button label="Connect a different card" variant="secondary" disabled={locked} onPress={identify} />
          )}
          {!issuer && (
            <Button
              label="Bank issuance & settings"
              variant="secondary"
              disabled={locked}
              onPress={() => changeMode(true)}
            />
          )}
          {uid && issuer && (
            <Panel>
              <SectionTitle>Bank verification link</SectionTitle>
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
          {issuer && !!(message || error) && (
            <AppText accessibilityRole="alert" className="text-brass">
              {error || message}
            </AppText>
          )}
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
