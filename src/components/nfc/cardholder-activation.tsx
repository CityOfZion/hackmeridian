import { useState } from 'react';
import type { Issuance } from '@/api/item/card-issuance';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Muted, Panel, SectionTitle } from '@/components/wallet/primitives';

type Action = 'verify' | 'choose-pin' | 'verify-pin' | 'remove-pin';
const steps: Partial<Record<Issuance['phase'], { title: string; body: string; button: string; action: Action }>> = {
  'verify-holder': {
    title: 'Confirm this card belongs to you',
    body: 'Use the initial PIN supplied with your card. We will check your access before you choose a personal PIN.',
    button: 'Confirm with my initial PIN',
    action: 'verify',
  },
  'personal-pin-ready': {
    title: '1 of 3 · Choose your personal PIN',
    body: 'Choose 6–12 characters. Then confirm the initial PIN and hold your card to save the new PIN. Your accounts and keys stay on the card.',
    button: 'Choose and save my PIN',
    action: 'choose-pin',
  },
  'verify-personal-pin': {
    title: '2 of 3 · Test your new PIN',
    body: 'Your new PIN is saved. Enter it and tap the card to check it works. The initial PIN stays active until this check succeeds.',
    button: 'Test my new PIN',
    action: 'verify-pin',
  },
  'remove-default-pin': {
    title: '3 of 3 · Finish PIN setup',
    body: 'Your new PIN works. Enter it once more and tap the card to disable the initial PIN. After this, use only your personal PIN.',
    button: 'Finish PIN setup',
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
            Keep your card nearby. You can leave and resume this step; your PIN is never saved on this phone.
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
