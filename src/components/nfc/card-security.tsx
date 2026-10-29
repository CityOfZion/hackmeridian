import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getRandomBytes } from 'expo-crypto';
import { loadCredential, savePinCredential, forgetCredential } from '@/api/item/card-signing';
import type { CardCredential, PinInput } from '@/api/item/card-auth';
import { enrollNewPin, verifyNewPin, removeOldPin } from '@/api/item/pin-change';
import { accessPinCard } from '@/hooks/use-item-nfi';
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
    let input: PinInput | null = null;
    let next: PinInput | null = null;
    try {
      const change = credential.change;
      if (change?.stage === 'enrolling' || change?.stage === 'removing')
        throw new Error(
          'The previous card update has an unknown outcome. Inspect credentials with a supported card manager. VaultPass will not repeat it.',
        );
      const profile = {
        ...credential.profile,
        identityId: credential.profile.credentialIdentityId,
        credentialSlot: change?.stage === 'verify' ? change.newSlot! : credential.profile.credentialSlot,
      };
      if (!change) {
        next = await askPin({ title: 'Choose your new card PIN', uid, profile, newPin: true });
        if (!next) return;
      }
      input = await askPin({
        title: change ? 'Enter your new card PIN' : 'Confirm your current card PIN',
        uid,
        profile,
      });
      if (!input) return;
      if (next && input.password === next.password) throw new Error('Choose a different new PIN.');
      dispatch(
        tapStarted(
          change?.stage === 'verify'
            ? 'Verify your new PIN'
            : change?.stage === 'remove'
              ? 'Remove the old PIN'
              : 'Add your new PIN',
        ),
      );
      const done = await accessPinCard(
        'Hold your card until the PIN step finishes',
        { expectedUid: uid, pin: input, onStep: (step) => dispatch(tapStepChanged(step)) },
        async (tunnel) => {
          const save = async (value: Extract<CardCredential, { mode: 'pin' }>) => {
            await savePinCredential(uid, value.profile, value.publicKey, value.change);
            setCredential(value);
          };
          if (!change && next) await enrollNewPin(tunnel, uid, credential, next.password, getRandomBytes, save);
          else if (change?.stage === 'verify') await verifyNewPin(tunnel, credential, input!.profile, save);
          else if (change?.stage === 'remove') await removeOldPin(tunnel, credential, input!.profile, save);
        },
      );
      dispatch(done ? tapSucceeded() : tapDismissed());
      if (done)
        setMessage(
          !change
            ? 'New PIN enrolled. Verify it in the next step; the old PIN still works.'
            : change.stage === 'verify'
              ? 'New PIN verified and selected. Remove the old PIN to finish.'
              : 'PIN changed. Your signing key and account are unchanged.',
        );
    } catch (e) {
      const text = e instanceof Error ? e.message : 'PIN update did not finish.';
      setMessage(text);
      dispatch(tapFailed(text));
    } finally {
      if (input) input.password = '';
      if (next) next.password = '';
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
            ? 'PIN authentication. This phone stores your public card identity, never your PIN.'
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
          <Muted>
            Signing identity {credential.profile.identityId} · PIN identity {credential.profile.credentialIdentityId} ·
            slot {credential.profile.credentialSlot}
          </Muted>
          {change && (
            <Muted>
              {change.stage === 'verify'
                ? 'Step 2 of 3: verify the new PIN. The old credential remains active.'
                : change.stage === 'remove'
                  ? 'Step 3 of 3: remove the old PIN. Both credentials currently work.'
                  : 'An update has an unknown outcome. Keep your PINs; inspect credentials with a supported card manager before another change.'}
            </Muted>
          )}
          <Button
            label={
              change?.stage === 'verify'
                ? 'Verify new PIN'
                : change?.stage === 'remove'
                  ? 'Remove old PIN'
                  : 'Change card PIN'
            }
            disabled={busy || isTapping || change?.stage === 'enrolling' || change?.stage === 'removing'}
            onPress={changePin}
          />
        </>
      )}
      {credential?.mode !== 'pin' && (
        <Button label="Use legacy pairing key" variant="secondary" disabled={busy || isTapping} onPress={onLegacy} />
      )}
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
