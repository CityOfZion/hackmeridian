import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { deleteItemAsync, getItemAsync, setItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';
import { type WalletAccount, keyBytes, accountBinding } from '@/wallet/model';
import { accountServicePost } from '@/api/stellar/smart-account';
import {
  type FreezeIntent,
  type FreezeRecord,
  type FreezeStatus,
  validatePreparedFreeze,
  validateFreezeIntent,
} from '@/api/stellar/freeze-codec';
import { currentLedger } from '@/api/stellar/transfer';
import { signedTransferAuth, transferDigest } from '@/api/stellar/transfer-codec';
import { usePassTap } from '@/hooks/use-pass-tap';
import { hex } from '@/api/item/card-crypto';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Muted, Panel, SectionTitle } from './primitives';

type Receipt = { id: string; signature: string; intent: FreezeIntent };
export function AccountProtection({ account }: { account: WalletAccount }) {
  const [status, setStatus] = useState<FreezeStatus>();
  const [receipt, setReceipt] = useState<Receipt>();
  const [review, setReview] = useState<FreezeIntent>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const { signWithPass, isTapping, error } = usePassTap();
  const storage = `item.freeze.${account.id}`;
  const read = async () => {
    const next = await accountServicePost<FreezeStatus>('/freeze/state', { account: account.id });
    setStatus(next);
  };
  const reconcile = async (saved: Receipt) => {
    let r = await accountServicePost<FreezeRecord>('/freeze/status', { id: saved.id });
    if (
      r.prepared.id !== saved.id ||
      JSON.stringify(validateFreezeIntent(r.intent)) !== JSON.stringify(validateFreezeIntent(saved.intent))
    )
      throw new Error('Protection receipt does not match.');
    if (r.state === 'prepared')
      r = await accountServicePost<FreezeRecord>('/freeze/submit', { id: saved.id, signature: saved.signature });
    setMessage(
      r.state === 'confirmed'
        ? 'Account protection confirmed on Stellar.'
        : (r.message ?? `Approval ${r.state}. Check again without signing a replacement.`),
    );
    if (['confirmed', 'failed', 'expired'].includes(r.state)) {
      await deleteItemAsync(storage);
      setReceipt(undefined);
      await read();
    }
  };
  const run = async (work: () => Promise<void>) => {
    if (busy || isTapping) return;
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not update account protection.');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const raw = await getItemAsync(storage);
        if (!live) return;
        if (raw) {
          const saved = JSON.parse(raw) as Receipt;
          validateFreezeIntent(saved.intent);
          if (
            saved.intent.account !== account.id ||
            !/^[0-9a-f-]{36}$/.test(saved.id) ||
            !/^[0-9a-f]{128}$/.test(saved.signature)
          )
            throw new Error('Saved protection receipt needs recovery.');
          setReceipt(saved);
        }
        await read();
        if (live) setReady(true);
      } catch (e) {
        if (live) setMessage(e instanceof Error ? e.message : 'Protection status unavailable.');
      }
    })();
    return () => {
      live = false;
    };
    // Refreshes are explicit; changing the selected account remounts this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);
  const approve = () =>
    run(async () => {
      if (!review || receipt) return;
      const intent = validateFreezeIntent(review);
      const binding = accountBinding(account);
      const key = keyBytes(account.publicKey);
      const record = await accountServicePost<FreezeRecord>('/freeze/prepare', {
        publicKey: account.publicKey,
        intent,
        binding,
      });
      validatePreparedFreeze(record.prepared, intent, key, await currentLedger(), binding);
      const proof = await signWithPass(
        intent.action === 'install'
          ? 'Enable account protection'
          : intent.action === 'freeze'
            ? 'Freeze all spending'
            : 'Unfreeze account',
        transferDigest(record.prepared),
        account.cardUid,
        account.publicKey,
        account.ring,
      );
      if (!proof) return;
      validatePreparedFreeze(record.prepared, intent, key, await currentLedger(), binding);
      signedTransferAuth(record.prepared, key, proof.signature, binding);
      const saved = { id: record.prepared.id, intent, signature: hex(proof.signature) };
      await setItemAsync(storage, JSON.stringify(saved), { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      setReceipt(saved);
      setReview(undefined);
      await reconcile(saved);
    });
  const complete = status && status.rules.length > 0 && status.covered.length === status.rules.length;
  return (
    <Panel>
      <SectionTitle>Account protection · {account.name}</SectionTitle>
      <Muted>
        Freeze spending from this Stellar account across apps. Any authorized card, including a backup, can unfreeze it.
        Other accounts on the same card are separate.
      </Muted>
      {!status && <Muted>Protection status has not been verified.</Muted>}
      {status && !status.enabled && (
        <Muted>
          On-chain protection requires the reviewed freeze policy to be deployed and enabled by the service.
        </Muted>
      )}
      {status?.enabled && (
        <>
          <AppText>
            {complete
              ? status.frozen
                ? 'Account frozen'
                : 'Account active'
              : `Protection setup: ${status.covered.length} of ${status.rules.length} cards`}
          </AppText>
          {!receipt && !review && (
            <>
              {status.rules
                .filter((r) => !status.covered.includes(r))
                .map((ruleId) => (
                  <Button
                    key={ruleId}
                    label={`Enable protection for card rule ${ruleId + 1}`}
                    disabled={busy || isTapping || !ready}
                    onPress={() => setReview({ account: account.id, action: 'install', ruleId })}
                  />
                ))}
              {(complete || (status.frozen === true && status.covered.length > 0)) && (
                <Button
                  label={status.frozen ? 'Unfreeze account' : 'Freeze account'}
                  disabled={busy || isTapping || !ready}
                  onPress={() => setReview({ account: account.id, action: status.frozen ? 'unfreeze' : 'freeze' })}
                />
              )}
            </>
          )}
        </>
      )}
      {review && (
        <View className="gap-3">
          <Muted>
            {review.action === 'install'
              ? 'Your card will approve installation of the pinned VaultPass freeze policy.'
              : review.action === 'freeze'
                ? 'Spending and changes to account authority will be blocked until an authorized card unfreezes this account.'
                : 'Your card will restore spending from this account.'}
          </Muted>
          <Button label="Tap card to approve" disabled={busy || isTapping} onPress={approve} />
          <Button
            label="Cancel"
            variant="secondary"
            disabled={busy || isTapping}
            onPress={() => setReview(undefined)}
          />
        </View>
      )}
      {receipt && (
        <Button
          label="Check pending protection approval"
          disabled={busy || isTapping}
          onPress={() => run(() => reconcile(receipt))}
        />
      )}
      <Button
        label="Refresh protection status"
        variant="secondary"
        disabled={busy || isTapping}
        onPress={() =>
          run(async () => {
            await read();
            setReady(true);
          })
        }
      />
      {!!(message || error) && (
        <AppText accessibilityRole="alert" className="text-brass">
          {error || message}
        </AppText>
      )}
    </Panel>
  );
}
