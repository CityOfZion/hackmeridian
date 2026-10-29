import { useState } from 'react';
import type { Issuance } from '@/api/item/card-issuance';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Muted, Panel, SectionTitle } from '@/components/wallet/primitives';

type Action = 'recover' | 'verify' | 'choose-pin' | 'verify-pin' | 'remove-pin';
const steps: Partial<Record<Issuance['phase'], { title: string; body: string; button: string; action: Action }>> = {
  'personal-pin-unknown': {
    title: 'Recover interrupted PIN setup',
    body: 'The last scan ended before enrollment was confirmed. We will read the card, then use your initial PIN to check what was saved. No PIN is enrolled again during recovery.',
    button: 'Scan to recover setup',
    action: 'recover',
  },
  'remove-default-unknown': {
    title: 'Recover interrupted PIN setup',
    body: 'Your personal PIN was verified, but the final scan ended early. We will check whether the initial PIN was already removed and restore your progress.',
    button: 'Scan to recover setup',
    action: 'recover',
  },
  'verify-holder': {
    title: 'Set your personal PIN',
    body: 'Enter the initial PIN and choose your personal PIN once. Keep your card held while VaultPass checks ownership, saves the new PIN, verifies it, and disables the initial PIN.',
    button: 'Set PIN and continue',
    action: 'verify',
  },
  'personal-pin-ready': {
    title: 'Set your personal PIN',
    body: 'Choose your PIN once, then hold the card until setup finishes. Verification and removal of the initial PIN happen automatically.',
    button: 'Set PIN and continue',
    action: 'choose-pin',
  },
  'verify-personal-pin': {
    title: 'Finish your saved PIN setup',
    body: 'Your personal PIN is already saved. Enter it once to finish verification and retire the initial PIN. Do not create another PIN.',
    button: 'Continue PIN setup',
    action: 'verify-pin',
  },
  'remove-default-pin': {
    title: 'Finish your saved PIN setup',
    body: 'Your personal PIN has been verified. Enter it once to finish removing the initial PIN.',
    button: 'Continue PIN setup',
    action: 'remove-pin',
  },
};

export function CardholderActivation({
  record,
  loaded,
  locked,
  error,
  run,
  importDetails,
}: {
  record: Issuance | null;
  loaded: boolean;
  locked: boolean;
  error: string;
  run: (action: Action) => Promise<void>;
  importDetails: (value: string) => Promise<boolean>;
}) {
  const [handoff, setHandoff] = useState('');
  const [details, setDetails] = useState(false);
  const step = record ? steps[record.phase] : undefined;
  return (
    <Panel>
      <SectionTitle>
        {!loaded
          ? 'Checking card setup…'
          : (step?.title ??
            (record?.phase === 'complete'
              ? 'Your PIN is ready'
              : record
                ? 'Card setup needs attention'
                : 'Set up a new card'))}
      </SectionTitle>
      {loaded && !record && (
        <>
          <Muted>
            Your bank provides activation details with a new card. Load them here, then we will help you replace the
            initial PIN. If you already use a personal PIN, choose the option below this panel.
          </Muted>
          <FormField
            label="Paste bank activation details"
            value={handoff}
            onChangeText={setHandoff}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            editable={!locked}
          />
          <Button
            label="Continue with these details"
            disabled={locked || !handoff.trim()}
            onPress={async () => {
              if (await importDetails(handoff)) setHandoff('');
            }}
          />
          <Muted>
            No activation details? Ask the bank that issued your card. You do not need to create another masterkey.
          </Muted>
        </>
      )}
      {step && (
        <>
          <Muted>{step.body}</Muted>
          <Button label={step.button} disabled={locked || !loaded} onPress={() => run(step.action)} />
          <Muted>
            Your verified PIN stays in memory for this app session, so you can continue without re-entering it. It
            clears when you leave or lock the app.
          </Muted>
        </>
      )}
      {record && !step && record.phase !== 'complete' && (
        <Muted>
          {record.phase.includes('unknown')
            ? 'A card update was interrupted. Keep both PINs and ask your bank to inspect the card before continuing. Do not repeat setup or create another identity.'
            : 'Your bank needs to finish issuing this card before you can set your personal PIN. Return here after the bank completes ownership transfer.'}
        </Muted>
      )}
      {record?.phase === 'complete' && (
        <Muted>
          Your personal PIN is verified and the initial PIN has been removed. Next: review the masterkeys available to
          you.
        </Muted>
      )}
      {record && (
        <>
          <Button
            variant="secondary"
            label={details ? 'Hide technical details' : 'View technical details'}
            disabled={locked}
            onPress={() => setDetails(!details)}
          />
          {details && (
            <Muted>
              Identity {record.holder} · credential slot {record.personalSlot ?? record.credentialSlot ?? 'pending'} ·
              masterkey {record.master === undefined ? 'pending' : record.master + 1}.
              {record.issuerCanManageIdentities
                ? ' Your issuer retains identity-management permission on this card.'
                : ''}
            </Muted>
          )}
        </>
      )}
      {!!error && <Muted>{error}</Muted>}
    </Panel>
  );
}
