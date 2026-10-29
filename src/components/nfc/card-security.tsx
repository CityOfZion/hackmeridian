import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { getRandomBytes } from 'expo-crypto';
import { loadCredential, savePinCredential, forgetCredential } from '@/api/item/card-signing';
import type { CardCredential, PinInput } from '@/api/item/card-auth';
import { enrollNewPin, verifyNewPin, removeOldPin } from '@/api/item/pin-change';
import { recoverPinChange } from '@/api/item/pin-recovery';
import { cardPinSession } from '@/api/item/pin-session';
import { accessPinCard, withNfiSession } from '@/hooks/use-item-nfi';
import { usePassTap } from '@/hooks/use-pass-tap';
import { useCardPin } from './card-pin-provider';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Muted, Panel, SectionTitle } from '@/components/wallet/primitives';
import { useAppDispatch } from '@/store/hooks';
import { tapStarted, tapStepChanged, tapSucceeded, tapFailed, tapDismissed } from '@/store/slices/pass-tap-slice';
import { authenticateDevice } from '@/wallet/device-auth';
import { claimCardAction } from '@/api/item/card-operation';

export function CardSecurity({ uid, appLock, onLegacy }: { uid: string; appLock: boolean; onLegacy: () => void }) {
  const askPin = useCardPin();
  const dispatch = useAppDispatch();
  const { tapPass, isTapping, error } = usePassTap();
  const [credential, setCredential] = useState<CardCredential | null>();
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const [message, setMessage] = useState<string>();
  const refresh = () => loadCredential(uid).then(setCredential);
  useEffect(() => {
    let live = true;
    loadCredential(uid)
      .then((c) => {
        if (live) setCredential(c);
      })
      .catch(() => {
        if (live) setMessage('Could not read saved card access.');
      });
    return () => {
      live = false;
    };
  }, [uid]);

  const changePin = async () => {
    if (credential?.mode !== 'pin') return;
    let release: () => void;
    try {
      release = claimCardAction();
    } catch {
      setMessage('Another card action is in progress.');
      return;
    }
    setBusy(true);
    setMessage(undefined);
    dispatch(tapDismissed());
    let input: Awaited<ReturnType<typeof askPin>> = null;
    let newPassword = '';
    try {
      const loaded = await loadCredential(uid);
      if (loaded?.mode !== 'pin') throw new Error('Reconnect this card before changing its PIN.');
      let current = loaded;
      const save = async (value: Extract<CardCredential, { mode: 'pin' }>) => {
        await savePinCredential(uid, value.profile, value.publicKey, value.change);
        current = value;
        setCredential(value);
      };
      const change = current.change;
      const recovery = change?.stage === 'enrolling' || change?.stage === 'removing';
      let slots: number[] | null = null;
      if (recovery) {
        dispatch(tapStarted('Inspecting interrupted PIN change'));
        slots = await withNfiSession(
          'Check card credentials',
          { expectedUid: uid, discoveryOnly: true },
          async (_t, _info, _saved, _mode, _key, inspect) => inspect!(current.profile.credentialIdentityId),
        );
        dispatch(tapDismissed());
        if (!slots) return;
      }
      const profile = {
        ...current.profile,
        identityId: current.profile.credentialIdentityId,
        credentialSlot:
          change?.stage === 'verify' || change?.stage === 'removing'
            ? change.newSlot!
            : change?.stage === 'enrolling'
              ? change.oldSlot
              : current.profile.credentialSlot,
      };
      input = await askPin({
        uid,
        profile,
        title: recovery ? 'Recover PIN change' : change ? 'Finish PIN change' : 'Change your PIN',
        description: recovery
          ? change?.stage === 'enrolling'
            ? 'Enter your previous PIN. We will check whether the new PIN was saved without enrolling it again.'
            : 'Enter your new PIN. We will check whether the old PIN was already removed.'
          : change
            ? 'Enter the new PIN you already chose. Hold your card while the app finishes the saved change.'
            : 'Enter your current PIN and choose a new one once. Hold your card while it is saved, verified, and the old PIN is removed.',
        changePin: !change,
        fresh: !!change,
        defaults: 'personal',
      });
      if (!input) return;
      newPassword = change ? input.password : input.newPassword!;
      cardPinSession.clear();
      const generation = cardPinSession.generation();
      const session = async (pin: PinInput, work: Parameters<typeof accessPinCard>[2]) => {
        if (AppState.currentState !== 'active' || generation !== cardPinSession.generation())
          throw new Error('PIN change paused. Return to the app to continue.');
        return accessPinCard(
          'Keep holding your card',
          { expectedUid: uid, pin, onStep: (step) => dispatch(tapStepChanged(step)) },
          work,
        );
      };
      dispatch(tapStarted(recovery ? 'Recovering PIN change' : 'Updating your PIN · keep holding your card'));
      if (recovery) {
        const done = await session({ profile, password: input.password }, async (t) => {
          await recoverPinChange(t, uid, current, slots!, profile.credentialSlot, save);
        });
        if (done && !current.change)
          cardPinSession.remember(uid, { profile: current.profile, password: newPassword }, generation);
        dispatch(done ? tapSucceeded() : tapDismissed());
        setMessage(
          done
            ? current.change
              ? 'Progress recovered. Continue with the PIN you already chose.'
              : 'Recovery complete. Your current PIN is ready to use.'
            : 'Scan cancelled. Tap Recover to continue.',
        );
        return;
      }
      if (!change) {
        const done = await session({ profile, password: input.password }, (t) =>
          enrollNewPin(t, uid, current, newPassword, getRandomBytes, save),
        );
        if (!done) {
          dispatch(tapDismissed());
          return;
        }
      }
      const personalProfile = { ...profile, credentialSlot: current.change!.newSlot! };
      const done = await session({ profile: personalProfile, password: newPassword }, async (t) => {
        if (current.change?.stage === 'verify') await verifyNewPin(t, current, personalProfile, save);
        await removeOldPin(t, current, personalProfile, save);
      });
      if (done) {
        cardPinSession.remember(uid, { profile: current.profile, password: newPassword }, generation);
        setMessage('PIN changed. Continue using your card without re-entering it in this app session.');
      }
      dispatch(done ? tapSucceeded() : tapDismissed());
    } catch (e) {
      cardPinSession.clear();
      const text = e instanceof Error ? e.message : 'PIN update paused. Your progress is saved.';
      setMessage(text);
      dispatch(tapFailed(text));
    } finally {
      if (input) {
        input.password = '';
        input.newPassword = '';
      }
      newPassword = '';
      await refresh().catch(() => undefined);
      setBusy(false);
      release();
    }
  };
  const change = credential?.mode === 'pin' ? credential.change : undefined;
  return (
    <Panel>
      <SectionTitle>Card PIN & access</SectionTitle>
      <Muted>
        {credential === undefined
          ? 'Checking card access…'
          : credential?.mode === 'pin'
            ? 'PIN authentication. Your verified PIN stays in memory until you leave or lock the app. It is never written to storage.'
            : credential?.mode === 'pairing'
              ? 'Legacy pairing key saved securely on this phone.'
              : 'No card access saved. Your accounts remain available to view.'}
      </Muted>
      {credential?.mode !== 'pin' && (
        <Button
          label="Connect using card PIN"
          disabled={busy || isTapping}
          onPress={async () => {
            const result = await tapPass('Connect with your card PIN', undefined, undefined, uid, { forcePin: true });
            if (result) await refresh();
          }}
        />
      )}
      {credential?.mode === 'pin' && (
        <>
          {details && (
            <Muted>
              Signing identity {credential.profile.identityId} · PIN identity {credential.profile.credentialIdentityId}{' '}
              · slot {credential.profile.credentialSlot}
            </Muted>
          )}
          {!change && (
            <Muted>
              Enter your current and new PIN once, then hold the card until the change finishes. Your account keys and
              balances stay the same.
            </Muted>
          )}
          {change && (
            <Muted>
              {change.stage === 'verify'
                ? 'Your new PIN is saved. Continue to finish with the same PIN.'
                : change.stage === 'remove'
                  ? 'Your new PIN was verified. Continue to finish removing the old PIN.'
                  : 'The last scan ended early. Recover below to check the card and restore your progress without repeating the write.'}
            </Muted>
          )}
          <Button
            label={
              change?.stage === 'enrolling' || change?.stage === 'removing'
                ? 'Recover PIN change'
                : change
                  ? 'Finish PIN change'
                  : 'Change my PIN'
            }
            disabled={busy || isTapping}
            onPress={changePin}
          />
        </>
      )}
      {credential?.mode !== 'pin' && (
        <Button label="Use legacy pairing key" variant="secondary" disabled={busy || isTapping} onPress={onLegacy} />
      )}
      <Button
        label={details ? 'Hide access settings' : 'More access settings'}
        variant="secondary"
        disabled={busy || isTapping}
        onPress={() => setDetails(!details)}
      />
      {details && (
        <Button
          label="Forget saved card access"
          variant="secondary"
          disabled={!credential || busy || isTapping || !!change}
          onPress={() =>
            Alert.alert(
              'Forget saved card access?',
              'This removes this phone’s authentication profile or pairing key. Your card and viewable accounts remain unchanged. Keep your PIN or legacy pairing key to reconnect.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Forget access',
                  style: 'destructive',
                  onPress: async () => {
                    setBusy(true);
                    try {
                      if (appLock) await authenticateDevice('Forget saved card access');
                      await forgetCredential(uid);
                      setCredential(null);
                      setMessage('Saved access removed. Accounts remain available to view.');
                    } catch {
                      setMessage('Could not remove saved card access.');
                    } finally {
                      setBusy(false);
                    }
                  },
                },
              ],
            )
          }
        />
      )}
      <Muted>
        Add a backup card while you still have access. An enrolled backup can approve transactions and manage account
        protection. Resetting a card can destroy its wallet keys.
      </Muted>
      {(message || error) && (
        <AppText accessibilityRole="alert" className="text-brass">
          {error ?? message}
        </AppText>
      )}
    </Panel>
  );
}
