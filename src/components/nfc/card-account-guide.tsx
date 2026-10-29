import { View } from 'react-native';
import type { inspectOwnedKeys } from '@/api/item/card-management';
import { selectedCardRing } from '@/wallet/card-setup';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Choice, Muted, Panel, SectionTitle } from '@/components/wallet/primitives';

export type AccountGuideMode = 'select' | 'create' | 'review' | 'created';
export function CardAccountGuide({
  step,
  keys,
  master,
  ring,
  name,
  mode,
  locked,
  onInspect,
  onMaster,
  onContinue,
  onBack,
  onRing,
  onName,
  onMode,
  onCreate,
  onOpen,
  accountName,
}: {
  step: 3 | 4;
  keys?: Awaited<ReturnType<typeof inspectOwnedKeys>>;
  master: string;
  ring: string;
  name: string;
  mode: AccountGuideMode;
  locked: boolean;
  onInspect: () => void;
  onMaster: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  onRing: (value: string) => void;
  onName: (value: string) => void;
  onMode: (value: AccountGuideMode) => void;
  onCreate: () => void;
  onOpen: () => void;
  accountName: (ring: number) => string;
}) {
  const selectedMaster = keys?.masters.find((m) => String(m.slot) === master);
  const selectedRing = selectedCardRing(keys?.rings, master, ring);
  const rings = keys?.rings.filter((r) => String(r.master) === master) ?? [];
  if (step === 3)
    return (
      <Panel>
        <SectionTitle>Review your masterkeys</SectionTitle>
        <Muted>
          A masterkey is the source of the account keys on your card. Your bank issues it to you; its private key stays
          inside the card.
        </Muted>
        {!keys ? (
          <>
            <Muted>
              Enter your personal PIN and hold the card to read the masterkeys you can use. This does not create or
              change anything.
            </Muted>
            <Button label="Tap to review my masterkeys" disabled={locked} onPress={onInspect} />
          </>
        ) : (
          <>
            <Muted>
              {keys.masters.length
                ? 'Choose the masterkey for your account.'
                : 'No account masterkey is available to this identity. Ask your bank to finish issuing the card, or check your card access profile.'}
            </Muted>
            {keys.masters.map((m) => (
              <Choice
                key={m.slot}
                title={`Masterkey ${m.slot + 1}`}
                detail={`Owned by identity ${m.uid} · ${m.rings.length} existing keyring${m.rings.length === 1 ? '' : 's'}`}
                selected={master === String(m.slot)}
                onPress={() => {
                  if (!locked) onMaster(String(m.slot));
                }}
              />
            ))}
            {selectedMaster && (
              <Button label={`Use masterkey ${selectedMaster.slot + 1}`} disabled={locked} onPress={onContinue} />
            )}
            <Button label="Read card again" variant="secondary" disabled={locked} onPress={onInspect} />
          </>
        )}
      </Panel>
    );

  return (
    <Panel>
      <SectionTitle>
        {mode === 'created'
          ? 'Your account keyring is ready'
          : mode === 'review'
            ? 'Review your new account'
            : mode === 'create'
              ? 'Name your new account'
              : 'Choose an account'}
      </SectionTitle>
      <Muted>Masterkey {Number(master) + 1} · each keyring has its own signing key and Stellar smart account.</Muted>
      {mode === 'select' && (
        <>
          <Muted>
            {rings.length
              ? 'Open an existing account, or create a separate one for checking, savings, or another purpose.'
              : 'No compatible account keyrings were found under this masterkey. Create your first account to continue.'}
          </Muted>
          {rings.map((r) => (
            <Choice
              key={r.ring}
              title={accountName(r.ring)}
              detail={`Keyring ${r.ring + 1} · P-256`}
              selected={ring === String(r.ring)}
              onPress={() => {
                if (!locked) onRing(String(r.ring));
              }}
            />
          ))}
          {!!rings.length && (
            <Button
              label={selectedRing ? `Open ${accountName(selectedRing.ring)}` : 'Select an account above'}
              disabled={locked || !selectedRing}
              onPress={onOpen}
            />
          )}
          <Button
            label="Create a new account"
            variant={rings.length ? 'secondary' : 'primary'}
            disabled={locked || !keys?.engines.length}
            onPress={() => onMode('create')}
          />
          {!keys?.engines.length && (
            <Muted>
              This card has no available P-256 signing engine. Ask your bank to check the card configuration.
            </Muted>
          )}
        </>
      )}
      {mode === 'create' && (
        <>
          <Muted>
            Choose a name you will recognize in your wallet. Creating an account adds one keyring to this card.
          </Muted>
          <View className="gap-2">
            {['Checking', 'Savings'].map((value) => (
              <Choice
                key={value}
                title={value}
                selected={name === value}
                onPress={() => {
                  if (!locked) onName(value);
                }}
              />
            ))}
          </View>
          <FormField label="Account name" value={name} onChangeText={onName} maxLength={40} editable={!locked} />
          <Button label="Review account" disabled={locked || !name.trim()} onPress={() => onMode('review')} />
          <Button label="Back to accounts" variant="secondary" disabled={locked} onPress={() => onMode('select')} />
        </>
      )}
      {mode === 'review' && (
        <>
          <SectionTitle>{name.trim()}</SectionTitle>
          <Muted>
            The next tap creates a new P-256 keyring under masterkey {Number(master) + 1}. This is saved on your card.
            It does not move any funds.
          </Muted>
          <Muted>
            After creation, open the account to verify its card signature and load or create its Stellar smart account.
          </Muted>
          <Button
            label={`Tap to create ${name.trim()}`}
            disabled={locked || !name.trim() || !selectedMaster || !keys?.engines.length}
            onPress={onCreate}
          />
          <Button label="Edit account name" variant="secondary" disabled={locked} onPress={() => onMode('create')} />
        </>
      )}
      {mode === 'created' && (
        <>
          <SectionTitle>{name.trim()}</SectionTitle>
          <Muted>
            Keyring {Number(ring) + 1} was created on your card. One more approval opens its Stellar smart account and
            loads your balances. You do not need to create it again.
          </Muted>
          <Button label={`Open ${name.trim()}`} disabled={locked || !selectedRing} onPress={onOpen} />
          <Button label="View other accounts" variant="secondary" disabled={locked} onPress={() => onMode('select')} />
        </>
      )}
      <Button label="Back to masterkeys" variant="secondary" disabled={locked} onPress={onBack} />
    </Panel>
  );
}
