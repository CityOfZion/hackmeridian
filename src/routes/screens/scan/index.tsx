import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { getItemAsync, setItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Muted, Panel, SectionTitle } from '@/components/wallet/primitives';
import { CardSecurity } from '@/components/nfc/card-security';
import { useCardPin } from '@/components/nfc/card-pin-provider';
import { CardWorkspace, type CardWorkspaceInitial } from '@/routes/screens/wallet/card-workspace';
import { ScreenLayout } from '@/layouts/screen-layout';
import { cancelNfiScan, withNfiSession } from '@/hooks/use-item-nfi';
import { usePassTap } from '@/hooks/use-pass-tap';
import { useSignIn } from '@/hooks/use-sign-in';
import { claimCardAction } from '@/api/item/card-operation';
import { issuanceStorageKey, parseIssuance } from '@/api/item/card-issuance';
import { inspectUserCard } from '@/api/item/card-onboarding';
import { cardEntryIntent, entryPinProfile, entryAccount } from '@/wallet/card-entry';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectWallet, selectWalletAccount } from '@/store/slices/wallet-slice';
import { tapDismissed, tapFailed, tapStarted, tapStepChanged, tapSucceeded } from '@/store/slices/pass-tap-slice';

/** Read-only discovery, then one deliberate PIN approval. Never retries failed authentication. */
export function ScanScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const wallet = useAppSelector(selectWallet);
  const selected = useAppSelector(selectWalletAccount);
  const ask = useCardPin();
  const { signIn } = useSignIn();
  const { tapPass, isTapping, error: walletError } = usePassTap();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uid, setUid] = useState<string>();
  const [workspace, setWorkspace] = useState<CardWorkspaceInitial>();
  const [pinRecovery, setPinRecovery] = useState(false);
  const locked = busy || isTapping;
  const active = useRef(true);
  const scanning = useRef(false);
  useEffect(() => {
    const focus = navigation.addListener('focus', () => {
      active.current = true;
    });
    const blur = navigation.addListener('blur', () => {
      active.current = false;
      if (scanning.current) void cancelNfiScan();
    });
    return () => {
      focus();
      blur();
      active.current = false;
      if (scanning.current) void cancelNfiScan();
    };
  }, [navigation]);
  const scan = async () => {
    let release: (() => void) | undefined;
    let input: Awaited<ReturnType<typeof ask>> = null;
    try {
      release = claimCardAction();
      scanning.current = true;
      setBusy(true);
      setError('');
      setPinRecovery(false);
      dispatch(tapStarted('Checking your card'));
      const card = await withNfiSession(
        'Check your card',
        {
          discoveryOnly: true,
          onStep: (s) => dispatch(tapStepChanged(s)),
        },
        async (_t, info, credential, _mode, _key, inspect) => {
          const raw = await getItemAsync(issuanceStorageKey(info.uid));
          const record = raw ? parseIssuance(raw, info.uid) : null;
          const journal = await getItemAsync(`item.card-action.${info.uid}`);
          const intent = cardEntryIntent(record, credential, journal);
          const holder = record?.holder ?? (credential?.mode === 'pin' ? credential.profile.credentialIdentityId : 2);
          const slots = intent === 'inspect' && info.initialization ? await inspect!(holder) : [];
          return { uid: info.uid, record, credential, intent, slots, pinSupported: !!info.initialization };
        },
      );
      dispatch(tapDismissed());
      if (!card || !active.current) return;
      setUid(card.uid);
      if (card.intent === 'setup') {
        setWorkspace({ uid: card.uid });
        return;
      }
      if (card.intent === 'pin-recovery') {
        setPinRecovery(true);
        return;
      }
      if (card.intent === 'legacy' || !card.pinSupported) {
        release();
        release = undefined;
        const result = await tapPass(
          'Open your wallet',
          undefined,
          (expectedUid) => {
            if (active.current) navigation.navigate('(drawers)/pass/pairing-key', { expectedUid });
          },
          card.uid,
        );
        if (active.current) signIn(result);
        return;
      }
      const profile = entryPinProfile(card.record, card.credential, card.slots);
      input = await ask({
        title:
          profile.credentialSlot === 0 && !card.record && !card.credential ? 'Unlock your card' : 'Open your wallet',
        uid: card.uid,
        profile,
        editProfile: !card.record && !card.credential,
        defaults: profile.credentialSlot === 0 && !card.record && !card.credential ? 'initial-holder' : 'personal',
        description:
          'Enter your card PIN once. We will check setup and take you to the next step. For a new card, use the initial PIN from your bank.',
      });
      if (!input || !active.current) return;
      if (
        input.profile.identityId !== profile.identityId ||
        input.profile.credentialIdentityId !== profile.credentialIdentityId ||
        input.profile.credentialSlot !== profile.credentialSlot
      )
        throw new Error(
          'This card uses a different access profile. Open bank activation details below to continue with its supplied profile.',
        );
      const initialPin = input.password === '000000';
      dispatch(tapStarted('Checking your accounts'));
      const inspected = await withNfiSession(
        'Check your accounts',
        {
          expectedUid: card.uid,
          pin: input,
          cachePin: true,
          onStep: (s) => dispatch(tapStepChanged(s)),
        },
        (t) => inspectUserCard(t, card.uid, profile, card.slots, initialPin),
      );
      if (!inspected || !active.current) {
        dispatch(tapDismissed());
        return;
      }
      if (inspected.record) {
        // Persist only a read-verified standard handoff; never overwrite an existing receipt.
        if (await getItemAsync(issuanceStorageKey(card.uid)))
          throw new Error('Card setup already has a receipt. Scan again to resume it.');
        await setItemAsync(issuanceStorageKey(card.uid), JSON.stringify(inspected.record), {
          keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        dispatch(tapSucceeded());
        setWorkspace({ uid: card.uid, profile });
        return;
      }
      const preferred = selected?.cardUid === card.uid ? selected : wallet.accounts.find((a) => a.cardUid === card.uid);
      const ring = entryAccount(card.uid, inspected.keys.rings, preferred);
      dispatch(tapSucceeded());
      release();
      release = undefined;
      const initial = { uid: card.uid, profile, keys: inspected.keys, personalPin: true };
      if (!ring) {
        setWorkspace(initial);
        return;
      }
      const result = await tapPass('Open your wallet', undefined, undefined, card.uid, {
        forcePin: true,
        pinProfile: profile,
        ring: ring.ring,
        expectedPublicKey: ring.publicKey,
        allowAccountChange: true,
        name: wallet.accounts.find((a) => a.cardUid === card.uid && a.ring === ring.ring)?.name ?? 'Checking',
      });
      if (!active.current) return;
      if (result) signIn(result);
      else setWorkspace({ ...initial, openError: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not check your card. Your saved progress is safe.';
      setError(message);
      dispatch(tapFailed(message));
    } finally {
      if (input) input.password = '';
      release?.();
      scanning.current = false;
      setBusy(false);
    }
  };
  if (workspace) return <CardWorkspace mode="user-entry" initial={workspace} />;
  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>VaultPass · User</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{pinRecovery ? 'Finish your PIN change' : 'Tap your card'}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body contentContainerClassName="pb-safe-offset-8">
        <View className="gap-5">
          {pinRecovery && uid ? (
            <>
              <Muted>Your saved PIN change needs to finish before opening this wallet.</Muted>
              <CardSecurity uid={uid} appLock={wallet.appLock} onLegacy={() => {}} />
              <Button label="Continue after PIN recovery" disabled={locked} onPress={scan} />
            </>
          ) : (
            <>
              <Panel>
                <SectionTitle>Hold your card against your phone</SectionTitle>
                <Muted>
                  We’ll check your card and open your wallet, or help you finish setup. Keep the card in place until the
                  scan completes.
                </Muted>
              </Panel>
              <Button
                icon="tap"
                label={locked ? 'Checking your card…' : error ? 'Scan again' : 'Scan my card'}
                disabled={locked}
                onPress={scan}
              />
              <Muted>
                Your saved progress is kept if a scan is interrupted. No PIN or card update is retried automatically.
              </Muted>
            </>
          )}
          {!!(error || walletError) && (
            <AppText accessibilityRole="alert" className="text-danger">
              {error || walletError}
            </AppText>
          )}
          {uid && error && (
            <Button
              label="Use bank activation details"
              variant="secondary"
              disabled={locked}
              onPress={() => setWorkspace({ uid })}
            />
          )}
          <Button
            label="Switch role"
            variant="secondary"
            disabled={locked}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: '(screens)/welcome' }] })}
          />
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
