import { useEffect, useState } from 'react';
import { setStringAsync } from 'expo-clipboard';
import { getRandomBytes } from 'expo-crypto';
import { getItemAsync, setItemAsync, deleteItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';
import type { ItemSecureTunnel } from '@item-systems/item/mobile';
import {
  activationHandoff,
  startIssuance,
  advanceIssuance,
  inspectIssuance,
  verifyIssuance,
  choosePersonalPin,
  verifyPersonalPin,
  removeDefaultPin,
  parseIssuance,
  issuanceStorageKey,
  type Issuance,
} from '@/api/item/card-issuance';
import { claimCardAction } from '@/api/item/card-operation';
import { DEFAULT_FACTORY_PAIRING_KEY } from '@/api/item/issuer-bootstrap';
import type { PinInput, PinProfile } from '@/api/item/card-auth';
import { withNfiSession } from '@/hooks/use-item-nfi';
import { useCardPin } from './card-pin-provider';
import { useAppDispatch } from '@/store/hooks';
import { tapStarted, tapStepChanged, tapSucceeded, tapFailed, tapDismissed } from '@/store/slices/pass-tap-slice';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Muted, Panel, SectionTitle } from '@/components/wallet/primitives';

const ready = ['credential-ready', 'reserve-ready', 'master-ready'];
const descriptions: Record<Issuance['phase'], string> = {
  'identity-unknown': 'Identity creation needs inspection.',
  'credential-ready': 'Identity created. Initial PIN enrollment is next.',
  'credential-unknown': 'PIN enrollment needs credential inspection. Do not enroll again.',
  'reserve-ready': 'Initial PIN enrolled. Reserve the first master for the card tunnel.',
  'reserve-unknown': 'Tunnel master generation needs inspection.',
  'master-ready': 'Ready to create the cardholder masterkey.',
  'master-unknown': 'Account masterkey generation needs inspection.',
  'transfer-ready': 'Masterkey created on card. Review the recipient and transfer ownership.',
  'transfer-unknown': 'Ownership transfer needs inspection.',
  'verify-holder': 'Ownership transferred. The cardholder must verify access with their PIN.',
  'personal-pin-ready': 'Ownership verified. Choose a personal PIN before creating accounts.',
  'personal-pin-unknown': 'Personal PIN enrollment needs credential inspection. Do not enroll again.',
  'verify-personal-pin': 'Personal PIN enrolled. Verify it before removing the initial PIN.',
  'remove-default-pin': 'Personal PIN verified. Remove the initial PIN to finish activation.',
  'remove-default-unknown': 'Initial PIN removal needs credential inspection. Do not repeat it.',
  complete: 'Card activated. The initial PIN was removed. You can create checking and savings accounts.',
};

type Props = {
  uid: string;
  issuer: boolean;
  bootstrap: boolean;
  issuerProfile?: PinProfile;
  locked: boolean;
  onBusy: (busy: boolean) => void;
  onIssuerProfile: (profile: PinProfile) => void;
  onHolderProfile: (profile: PinProfile) => void;
};
export function BankIssuance({
  uid,
  issuer,
  bootstrap,
  issuerProfile,
  locked,
  onBusy,
  onIssuerProfile,
  onHolderProfile,
}: Props) {
  const ask = useCardPin();
  const dispatch = useAppDispatch();
  const [holder, setHolder] = useState('2');
  const [record, setRecord] = useState<Issuance | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(false);
  const [handoff, setHandoff] = useState('');
  const key = issuanceStorageKey(uid);
  useEffect(() => {
    let live = true;
    getItemAsync(key)
      .then((raw) => {
        const r = raw ? parseIssuance(raw, uid) : null;
        if (live) {
          setRecord(r);
          setLoaded(true);
          if (r?.phase === 'complete')
            onHolderProfile({ identityId: r.holder, credentialIdentityId: r.holder, credentialSlot: r.personalSlot! });
        }
      })
      .catch(() => {
        if (live) setError('Issuance receipt could not be read. Issuance stays blocked.');
      });
    return () => {
      live = false;
    };
  }, [key, uid, onHolderProfile]);
  const save = async (r: Issuance) => {
    await setItemAsync(key, JSON.stringify(r), { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    setRecord(r);
  };
  const run = async (
    action: 'prepare' | 'inspect' | 'transfer' | 'verify' | 'choose-pin' | 'verify-pin' | 'remove-pin',
  ) => {
    let release: (() => void) | undefined;
    let pin: PinInput | null = null;
    let personal: PinInput | null = null;
    const title = {
      prepare: 'Prepare bank-issued card',
      inspect: 'Inspect card issuance',
      transfer: 'Transfer masterkey ownership',
      verify: 'Verify cardholder ownership',
      'choose-pin': 'Choose your personal PIN',
      'verify-pin': 'Verify your personal PIN',
      'remove-pin': 'Remove the initial PIN',
    }[action];
    try {
      release = claimCardAction();
      onBusy(true);
      setError('');
      if (await getItemAsync(`item.card-action.${uid}`))
        throw new Error('Reconcile the previous card action before issuance.');
      const raw = await getItemAsync(key);
      const current = raw ? parseIssuance(raw, uid) : null;
      if (action === 'verify' && current?.phase !== 'verify-holder')
        throw new Error('Transfer ownership before cardholder verification.');
      if (action === 'prepare' && current && !ready.includes(current.phase))
        throw new Error('Inspect the existing issuance before continuing.');
      if (action !== 'prepare' && !current) throw new Error('No issuance receipt is available.');
      const holderLogin = ['verify', 'choose-pin', 'verify-pin', 'remove-pin'].includes(action);
      const usePersonal = action === 'verify-pin' || action === 'remove-pin';
      if (action === 'choose-pin') {
        personal = await ask({
          title: 'Choose your personal card PIN',
          uid,
          newPin: true,
          profile: {
            identityId: current!.holder,
            credentialIdentityId: current!.holder,
            credentialSlot: current!.credentialSlot!,
          },
        });
        if (!personal) return;
      }
      if (holderLogin || !bootstrap) {
        pin = await ask({
          title: holderLogin ? (usePersonal ? 'Enter your personal PIN' : 'Enter your initial card PIN') : 'Issuer PIN',
          defaults: holderLogin ? (usePersonal ? undefined : 'initial-holder') : 'issuer',
          uid,
          profile: holderLogin
            ? {
                identityId: current!.holder,
                credentialIdentityId: current!.holder,
                credentialSlot: usePersonal ? current!.personalSlot! : current!.credentialSlot!,
              }
            : issuerProfile,
        });
        if (!pin) return;
      }
      dispatch(tapStarted(title));
      const result = await withNfiSession(
        title,
        {
          expectedUid: uid,
          ...(holderLogin || !bootstrap
            ? { pin: pin! }
            : { pairingKey: DEFAULT_FACTORY_PAIRING_KEY, issuerBootstrap: true }),
          onStep: (s) => dispatch(tapStepChanged(s)),
        },
        async (t: ItemSecureTunnel) => {
          if (!holderLogin && pin) onIssuerProfile({ ...pin.profile });
          let next: Issuance;
          if (action === 'inspect') next = await inspectIssuance(t, current!, save);
          else if (action === 'verify') {
            next = await verifyIssuance(t, current!, save);
            onHolderProfile({ ...pin!.profile });
          } else if (action === 'choose-pin')
            next = await choosePersonalPin(
              t,
              current!,
              pin!.profile.credentialSlot,
              personal!.password,
              getRandomBytes,
              save,
            );
          else if (action === 'verify-pin')
            next = await verifyPersonalPin(t, current!, pin!.profile.credentialSlot, save);
          else if (action === 'remove-pin')
            next = await removeDefaultPin(t, current!, pin!.profile.credentialSlot, save);
          else if (action === 'transfer') next = await advanceIssuance(t, current!, save, getRandomBytes);
          else {
            next = current ?? (await startIssuance(t, uid, Number(holder), save));
            // Continue only acknowledged steps within this tap. Unknown states never enter this loop.
            while (ready.includes(next.phase)) next = await advanceIssuance(t, next, save, getRandomBytes);
          }
          if (holderLogin) onHolderProfile({ ...pin!.profile });
          setRecord(next);
          return true;
        },
      );
      dispatch(result ? tapSucceeded() : tapDismissed());
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Issuance did not finish. Inspect before continuing.';
      setError(message);
      dispatch(tapFailed(message));
    } finally {
      if (pin) pin.password = '';
      if (personal) personal.password = '';
      release?.();
      if (release) onBusy(false);
    }
  };

  return (
    <Panel>
      <SectionTitle>{issuer ? 'Issue a cardholder masterkey' : 'Activate your issued card'}</SectionTitle>
      {!record && !issuer && (
        <>
          <Muted>
            If the bank issued your card on another phone, paste its public activation details here, then verify with
            your initial PIN.
          </Muted>
          <FormField
            label="Activation details from your bank"
            value={handoff}
            onChangeText={setHandoff}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            editable={!locked && loaded}
          />
          <Button
            label="Load activation details"
            disabled={locked || !loaded || !handoff.trim()}
            onPress={async () => {
              let release: (() => void) | undefined;
              try {
                release = claimCardAction();
                if (await getItemAsync(key)) throw new Error('An issuance already exists for this card.');
                if (await getItemAsync(`item.card-action.${uid}`))
                  throw new Error('Reconcile the previous card action first.');
                await save(activationHandoff(handoff, uid));
                setHandoff('');
                setError('');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not load activation details.');
              } finally {
                release?.();
              }
            }}
          />
        </>
      )}
      {!record && issuer && (
        <>
          <Muted>
            Create a new cardholder identity with initial PIN 000000. The card generates the masterkey internally. You
            will review ownership transfer in a separate step.
          </Muted>
          <FormField
            label="New cardholder identity (unused number 1–127)"
            keyboardType="number-pad"
            maxLength={3}
            value={holder}
            editable={!locked && !review}
            onChangeText={setHolder}
          />
          <Muted>
            The recipient gets ownership of their masterkey and derived accounts, with no bank administration
            capabilities. A blank card also needs one reserved tunnel master.
          </Muted>
          {review ? (
            <>
              <Muted>
                Card {uid} · recipient identity {holder} · initial PIN has five attempts. This creates persistent card
                records.
              </Muted>
              <Button
                label="Create identity and masterkey"
                disabled={locked || !loaded}
                onPress={() => run('prepare')}
              />
              <Button label="Back" variant="secondary" disabled={locked} onPress={() => setReview(false)} />
            </>
          ) : (
            <Button
              label="Review issuance"
              disabled={locked || !loaded || !/^\d+$/.test(holder) || Number(holder) < 1 || Number(holder) > 127}
              onPress={() => setReview(true)}
            />
          )}
        </>
      )}
      {record && (
        <>
          <Muted>{descriptions[record.phase]}</Muted>
          <Muted>
            Cardholder identity {record.holder} · issuer identity {record.issuer}
            {record.master === undefined ? '' : ` · account master ${record.master + 1}`}
          </Muted>
          {record.credentialSlot !== undefined && (
            <Muted>
              Cardholder access profile: identity {record.holder}, credential identity {record.holder}, slot{' '}
              {record.personalSlot ?? record.credentialSlot}.
            </Muted>
          )}
          {issuer && ready.includes(record.phase) && (
            <Button label="Continue card setup" disabled={locked || !loaded} onPress={() => run('prepare')} />
          )}
          {issuer && record.phase === 'transfer-ready' && (
            <>
              <Muted>
                Transfer master {record.master! + 1} to cardholder identity {record.holder}. It will remain owner-only;
                this issuer session will lose direct access.
              </Muted>
              <Button
                label={`Transfer to identity ${record.holder}`}
                disabled={locked || !loaded}
                onPress={() => run('transfer')}
              />
            </>
          )}
          {issuer &&
            ![
              'complete',
              'personal-pin-ready',
              'personal-pin-unknown',
              'verify-personal-pin',
              'remove-default-pin',
              'remove-default-unknown',
            ].includes(record.phase) && (
              <Button
                label="Inspect issuance (read only)"
                variant="secondary"
                disabled={locked || !loaded}
                onPress={() => run('inspect')}
              />
            )}
          {issuer && record.phase === 'verify-holder' && (
            <Button
              label="Copy cardholder activation details"
              variant="secondary"
              disabled={locked || !loaded}
              onPress={async () => {
                try {
                  await setStringAsync(JSON.stringify(activationHandoff(JSON.stringify(record), uid)));
                } catch {
                  setError('Could not copy activation details.');
                }
              }}
            />
          )}
          {record.phase === 'verify-holder' && (
            <Button label="Verify with cardholder PIN" disabled={locked || !loaded} onPress={() => run('verify')} />
          )}
          {record.phase === 'personal-pin-ready' && (
            <Button label="Choose personal PIN" disabled={locked || !loaded} onPress={() => run('choose-pin')} />
          )}
          {record.phase === 'verify-personal-pin' && (
            <Button label="Verify personal PIN" disabled={locked || !loaded} onPress={() => run('verify-pin')} />
          )}
          {record.phase === 'remove-default-pin' && (
            <Button
              label="Remove initial PIN and activate"
              disabled={locked || !loaded}
              onPress={() => run('remove-pin')}
            />
          )}
          {record.issuerCanManageIdentities && (
            <Muted>
              The issuer still has identity-management permission on this card. Ownership transfer does not remove that
              permission or prove exclusive cardholder control.
            </Muted>
          )}
          {record.phase === 'complete' && (
            <>
              <Muted>Use My accounts to create an account with your personal PIN.</Muted>
              {issuer && (
                <Button
                  label="Start another issuance"
                  variant="secondary"
                  disabled={locked || !loaded}
                  onPress={async () => {
                    let release: (() => void) | undefined;
                    try {
                      release = claimCardAction();
                      await deleteItemAsync(key);
                      setRecord(null);
                      setReview(false);
                    } catch {
                      setError('Could not clear this completed local issuance receipt.');
                    } finally {
                      release?.();
                    }
                  }}
                />
              )}
            </>
          )}
        </>
      )}
      {!!error && <Muted>{error}</Muted>}
    </Panel>
  );
}
