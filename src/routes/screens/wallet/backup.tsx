import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Muted } from '@/components/wallet/primitives';
import { ScreenLayout } from '@/layouts/screen-layout';
import { usePassTap } from '@/hooks/use-pass-tap';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectWalletAccount, updateWallet } from '@/store/slices/wallet-slice';
import {
  accountBinding,
  accountSigners,
  keyBytes,
  shortAddress,
  type WalletAccount,
  type WalletCard,
} from '@/wallet/model';
import { hex } from '@/api/item/card-crypto';
import type { FreezeStatus } from '@/api/stellar/freeze-codec';
import { accountChallenge, accountServicePost } from '@/api/stellar/smart-account';
import { backupProofDigest, validatePreparedBackup, type BackupRecord } from '@/api/stellar/backup-codec';
import { signedTransferAuth, transferDigest } from '@/api/stellar/transfer-codec';
import { currentLedger } from '@/api/stellar/transfer';
import {
  clearBackup,
  backupMembership,
  backupStatus,
  loadBackup,
  saveBackup,
  submitBackup,
  type SavedBackup,
} from '@/api/stellar/backup';

export function WalletBackupScreen() {
  const account = useAppSelector(selectWalletAccount);
  if (!account)
    return (
      <ScreenLayout>
        <ScreenLayout.Header>
          <ScreenLayout.BackButton />
        </ScreenLayout.Header>
        <ScreenLayout.Body>
          <Muted>Select an account first.</Muted>
        </ScreenLayout.Body>
      </ScreenLayout>
    );
  return <BackupFlow key={account.id} account={account} />;
}
function BackupFlow({ account }: { account: WalletAccount }) {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const { proveWithPass, signWithPass, error: tapError } = usePassTap();
  const [record, setRecord] = useState<BackupRecord>();
  const [candidate, setCandidate] = useState<WalletCard>();
  const [saved, setSaved] = useState<SavedBackup>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [legacy, setLegacy] = useState(false);
  const [pairingKey, setPairingKey] = useState('');
  const [complete, setComplete] = useState(false);
  const working = useRef(false);
  usePreventRemove(busy, () => {});
  const run = async (fn: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the backup.');
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const accept = async (next: BackupRecord, receipt: SavedBackup) => {
    if (
      next.prepared.id !== receipt.id ||
      next.intent.account !== receipt.intent.account ||
      next.intent.publicKey !== receipt.intent.publicKey ||
      next.intent.protected !== receipt.intent.protected ||
      next.prepared.account !== account.id
    )
      throw new Error('Backup status does not match your approval.');
    setRecord(next);
    if (next.state === 'confirmed') {
      const member = await backupMembership(account.id, receipt.intent.publicKey);
      if (
        member.address !== account.id ||
        member.originPublicKey !== (receipt.source.originPublicKey ?? receipt.source.publicKey) ||
        member.ruleId < 1
      )
        throw new Error('The backup membership does not match this account.');
      await dispatch(
        updateWallet({
          type: 'enroll',
          account: {
            id: account.id,
            name: account.name,
            cardUid: receipt.card.uid,
            publicKey: receipt.card.publicKey,
            ring: receipt.card.ring,
            verifiedAt: new Date().toISOString(),
            originPublicKey: member.originPublicKey,
            ruleId: member.ruleId,
          },
          card: receipt.card,
        }),
      ).unwrap();
      await dispatch(
        updateWallet({ type: 'selectSigner', id: account.id, publicKey: receipt.source.publicKey }),
      ).unwrap();
      setComplete(true);
    }
  };
  const check = async (receipt = saved) => {
    if (!receipt) return;
    let next = await backupStatus(receipt.id);
    if (
      next.prepared.id !== receipt.id ||
      next.intent.account !== receipt.intent.account ||
      next.intent.publicKey !== receipt.intent.publicKey ||
      next.intent.protected !== receipt.intent.protected
    )
      throw new Error('Unexpected backup receipt.');
    if (next.state === 'prepared') next = await submitBackup(receipt);
    await accept(next, receipt);
  };
  useEffect(() => {
    let live = true;
    void loadBackup(account.id)
      .then(async (previous) => {
        if (!live) return;
        if (previous) {
          setSaved(previous);
          setCandidate(previous.card);
          await check(previous);
        }
        setReady(true);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not restore backup approval.');
      });
    return () => {
      live = false;
    };
    // Resume once for this account. Never start a fresh enrollment automatically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);
  const readBackup = () =>
    run(async () => {
      setRecord(undefined);
      setCandidate(undefined);
      setSaved(undefined);
      const challenge = await accountChallenge();
      const proof = await proveWithPass(
        'Tap the backup card',
        backupProofDigest(account.id, challenge.digest),
        pairingKey || undefined,
        () => setLegacy(true),
      );
      if (!proof) return;
      setPairingKey('');
      if (accountSigners(account).some((s) => s.cardUid === proof.uid || s.publicKey === hex(proof.publicKey)))
        throw new Error('Tap a different physical card for your backup.');
      const protection = await accountServicePost<FreezeStatus>('/freeze/state', { account: account.id });
      const intent = {
        account: account.id,
        publicKey: hex(proof.publicKey),
        ...(protection.covered.length ? { protected: true as const } : {}),
      };
      const next = await accountServicePost<BackupRecord>('/backups/prepare', {
        publicKey: account.publicKey,
        binding: accountBinding(account),
        intent,
        proof: { digest: challenge.digestHex, token: challenge.token, signature: hex(proof.signature) },
      });
      validatePreparedBackup(
        next.prepared,
        intent,
        keyBytes(account.publicKey),
        await currentLedger(),
        accountBinding(account),
      );
      setSaved(undefined);
      setCandidate({
        uid: proof.uid,
        name: 'Backup card',
        publicKey: intent.publicKey,
        firmware: proof.firmware,
        ring: proof.ring,
        ringCount: proof.ringCount,
        verifiedAt: new Date().toISOString(),
      });
      setRecord(next);
    });
  const approve = () =>
    run(async () => {
      if (!record || !candidate || saved) return;
      const key = keyBytes(account.publicKey);
      const ledger = await currentLedger();
      validatePreparedBackup(
        record.prepared,
        {
          account: account.id,
          publicKey: candidate.publicKey,
          ...(record.intent.protected ? { protected: true } : {}),
        },
        key,
        ledger,
        accountBinding(account),
      );
      if (record.prepared.expirationLedger - ledger < 24)
        throw new Error('This approval is nearly expired. Read the backup card again.');
      const proof = await signWithPass(
        'Tap the current card to approve this backup',
        transferDigest(record.prepared),
        account.cardUid,
        account.publicKey,
        account.ring,
      );
      if (!proof) return;
      signedTransferAuth(record.prepared, key, proof.signature, accountBinding(account));
      const receipt = {
        id: record.prepared.id,
        signature: hex(proof.signature),
        intent: record.intent,
        card: candidate,
        source: account,
      };
      await saveBackup(receipt);
      setSaved(receipt);
      await accept(await submitBackup(receipt), receipt);
    });
  const terminal = record && ['confirmed', 'failed', 'expired'].includes(record.state);
  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{account.name}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{complete ? 'Backup added' : 'Add a backup card'}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="gap-4">
          <Muted>Stellar Mainnet · {shortAddress(account.id)}</Muted>
          <AppText>
            Either card will be able to spend from this account and manage its authorized cards independently.
          </AppText>
          <Muted>
            Your balances and account address stay the same. The keys remain on their separate cards. Keep the backup
            somewhere safe.
          </Muted>
          {complete ? (
            <AppText>Both cards can now access this account. Choose the card to use in Your accounts.</AppText>
          ) : (
            <>
              <AppText>1. Tap the backup card.</AppText>
              <AppText>2. Review its key, then tap your current card to approve.</AppText>
              {candidate && (
                <>
                  <Muted>
                    Backup card {candidate.uid} · Keychain {candidate.ring}
                  </Muted>
                  <AppText selectable className="text-xs">
                    {candidate.publicKey}
                  </AppText>
                </>
              )}
              {legacy && !record && (
                <FormField
                  label="Backup card pairing key"
                  value={pairingKey}
                  onChangeText={setPairingKey}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
              {record && (
                <Muted>
                  {record.state === 'prepared' ? 'Ready for current-card approval' : `Enrollment: ${record.state}`}
                </Muted>
              )}
              {record?.message && <Muted>{record.message}</Muted>}
            </>
          )}
          {record?.hash && (
            <AppText selectable className="text-xs">
              {record.hash}
            </AppText>
          )}
          {(error || tapError) && <AppText className="text-danger">{error || tapError}</AppText>}
        </View>
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        {complete ? (
          <>
            <Button label="Done" onPress={() => navigation.goBack()} />
            <Button
              label="Add another backup"
              variant="secondary"
              disabled={busy}
              onPress={() =>
                run(async () => {
                  await clearBackup(account.id);
                  setSaved(undefined);
                  setRecord(undefined);
                  setCandidate(undefined);
                  setComplete(false);
                })
              }
            />
          </>
        ) : !ready ? (
          <Button
            label="Check saved approval"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const old = await loadBackup(account.id);
                if (old) {
                  setSaved(old);
                  await check(old);
                }
                setReady(true);
              })
            }
          />
        ) : saved && !terminal ? (
          <Button label="Check enrollment status" disabled={busy} onPress={() => run(() => check())} />
        ) : record && !terminal ? (
          <>
            <Button label="Approve with current card" disabled={busy} onPress={approve} />
            <Button label="Read backup again" variant="secondary" disabled={busy} onPress={readBackup} />
          </>
        ) : (
          <Button label="Tap backup card" disabled={busy} onPress={readBackup} />
        )}
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
