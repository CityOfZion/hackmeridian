import { useNavigation, usePreventRemove, type StaticScreenProps } from '@react-navigation/native';
import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { hex } from '@/api/item/card-crypto';
import {
  clearTransfer,
  loadTransfer,
  prepareTransfer,
  saveTransfer,
  submitTransfer,
  transferStatus,
  validateTransferNow,
  type SavedTransfer,
} from '@/api/stellar/transfer';
import {
  TRANSFER_ASSETS,
  signedTransferAuth,
  transferDigest,
  validateIntent,
  type TransferAsset,
  type TransferIntent,
  type TransferRecord,
} from '@/api/stellar/transfer-codec';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { InfoRows } from '@/components/ui/info-rows';
import { usePassTap } from '@/hooks/use-pass-tap';
import { ScreenLayout } from '@/layouts/screen-layout';
import { useGetVaultQuery, vaultApi } from '@/store/api/vault-api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectWallet, selectWalletAccount } from '@/store/slices/wallet-slice';
import { accountBinding, keyBytes, parsePaymentRequest, shortAddress, type WalletAccount } from '@/wallet/model';
import { recordReceipt } from '@/wallet/receipts';
import { Muted } from '@/components/wallet/primitives';
import { cn } from '@/utils/cn';

type SendParams = { recipient?: string; asset?: string; amount?: string; network?: string; note?: string } | undefined;
export function VaultSendScreen({ route }: StaticScreenProps<SendParams>) {
  const account = useAppSelector(selectWalletAccount);
  const navigation = useNavigation();
  if (!account)
    return (
      <ScreenLayout>
        <ScreenLayout.Header>
          <ScreenLayout.Heading>
            <ScreenLayout.Title>Connect a card first</ScreenLayout.Title>
          </ScreenLayout.Heading>
        </ScreenLayout.Header>
        <ScreenLayout.Body>
          <Muted>Connect your card before reviewing a payment request.</Muted>
          <Button label="Open wallet" onPress={() => navigation.navigate('(screens)/vault/dashboard')} />
        </ScreenLayout.Body>
      </ScreenLayout>
    );
  return <AccountSend key={account.id} account={account} params={route.params} />;
}
function AccountSend({ account, params }: { account: WalletAccount; params: SendParams }) {
  const { t } = useTranslation(['screens', 'common']);
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const chipId = account.id;
  const wallet = useAppSelector(selectWallet);
  const vault = useGetVaultQuery(chipId ?? skipToken);
  const { signWithPass, error: tapError, setError: setTapError } = usePassTap();
  const [initial] = useState(() => {
    try {
      if (params?.network)
        return {
          ...parsePaymentRequest(`vaultpass://pay?${new URLSearchParams(params as Record<string, string>)}`),
          error: undefined,
        };
      return {
        recipient: params?.recipient ?? '',
        asset: 'XLM' as TransferAsset,
        amount: '',
        note: '',
        error: undefined,
      };
    } catch (e) {
      return {
        recipient: '',
        asset: 'XLM' as TransferAsset,
        amount: '',
        note: '',
        error: e instanceof Error ? e.message : 'Invalid payment request.',
      };
    }
  });
  const [asset, setAsset] = useState<TransferAsset>(initial.asset);
  const [recipient, setRecipient] = useState(initial.recipient);
  const [requestText, setRequestText] = useState('');
  const [note, setNote] = useState(initial.note);
  const [amount, setAmount] = useState(initial.amount);
  const [record, setRecord] = useState<TransferRecord>();
  const [reviewed, setReviewed] = useState<TransferIntent>();
  const [saved, setSaved] = useState<SavedTransfer>();
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | undefined>(initial.error);
  const working = useRef(false);
  const mounted = useRef(true);
  usePreventRemove(busy, () => {});
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const acceptRecord = useCallback(
    async (next: TransferRecord) => {
      if (next.prepared.account !== account.id) throw new Error('The payment belongs to a different account.');
      if (next.state !== 'prepared') await recordReceipt(next);
      if (!mounted.current) return;
      setRecord(next);
      if (next.state === 'confirmed') dispatch(vaultApi.util.invalidateTags(['Vault']));
    },
    [dispatch, account.id],
  );

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (working.current) return;
      working.current = true;
      setBusy(true);
      setError(undefined);
      setTapError(undefined);
      try {
        await fn();
      } catch (e) {
        if (mounted.current) setError(e instanceof Error ? e.message : 'Unable to complete the payment.');
      } finally {
        working.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [setTapError],
  );

  const restore = useCallback(async () => {
    if (!chipId) return;
    await run(async () => {
      const previous = await loadTransfer(chipId, account.cardUid);
      if (previous) {
        setSaved(previous);
        setReviewed(previous.intent);
        await acceptRecord(await transferStatus(previous.id));
      }
      setRestored(true);
    });
  }, [chipId, account.cardUid, run, acceptRecord]);
  useEffect(() => {
    void restore();
  }, [restore]);

  const check = useCallback(async () => {
    if (!saved) return;
    await run(async () => {
      const next = await transferStatus(saved.id);
      // A response may have been lost before the server received the first submission.
      // Only this saved signature is ever retried; no new nonce or card approval is created.
      if (next.prepared.account !== account.id) throw new Error('The pending payment belongs to a different account.');
      await acceptRecord(next.state === 'prepared' ? await submitTransfer(saved) : next);
    });
  }, [saved, run, acceptRecord, account.id]);
  useEffect(() => {
    if (!saved || !['pending', 'unknown'].includes(record?.state ?? '')) return;
    const timer = setInterval(() => {
      void check();
    }, 6000);
    return () => clearInterval(timer);
  }, [saved, record?.state, check]);

  if (!chipId) return null;
  const terminal = record && ['confirmed', 'failed', 'expired'].includes(record.state);
  const pending = !!saved && !terminal;
  const edit = !record && !saved;
  const intent = reviewed ?? saved?.intent;
  const message = error || tapError;

  const review = () =>
    run(async () => {
      const nextIntent = validateIntent({
        asset,
        recipient: recipient.trim(),
        amount: amount.trim().replace(',', '.'),
      });
      const key = keyBytes(account.publicKey);
      const next = await prepareTransfer(key, nextIntent, accountBinding(account));
      await validateTransferNow(next, nextIntent, key, accountBinding(account));
      setReviewed(nextIntent);
      await acceptRecord(next);
    });

  const approve = () =>
    run(async () => {
      if (!record || !intent || saved) return;
      const key = keyBytes(account.publicKey);
      await validateTransferNow(record, intent, key, accountBinding(account));
      const proof = await signWithPass(
        t('vault.send.tapPrompt'),
        transferDigest(record.prepared),
        account.cardUid,
        account.publicKey,
        account.ring,
      );
      if (!proof) return;
      if (hex(proof.publicKey) !== hex(key)) throw new Error('The Pass signing key changed. Sign in again.');
      // Strict P-256 verification is separate from the generic card reader's supported curves.
      signedTransferAuth(record.prepared, key, proof.signature, accountBinding(account));
      const receipt = { id: record.prepared.id, signature: hex(proof.signature), intent };
      await saveTransfer(chipId, receipt);
      setSaved(receipt);
      await recordReceipt({ ...record, state: 'unknown' }, note);
      await acceptRecord(await submitTransfer(receipt));
    });

  const finish = () =>
    run(async () => {
      await clearTransfer(chipId);
      setSaved(undefined);
      setRecord(undefined);
      setReviewed(undefined);
      setAmount('');
      setRecipient('');
      setNote('');
    });

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>
            {account.name} · {shortAddress(account.id)}
          </ScreenLayout.Eyebrow>
          <ScreenLayout.Title>
            {t(
              record?.state === 'confirmed' ? 'vault.send.confirmed' : edit ? 'vault.send.title' : 'vault.send.review',
            )}
          </ScreenLayout.Title>
        </ScreenLayout.Heading>
        {!busy && <ScreenLayout.BackButton />}
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        {edit && restored && (
          <View className="gap-6">
            <FormField
              label="Paste a VaultPass payment request (optional)"
              value={requestText}
              onChangeText={setRequestText}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={2048}
            />
            {!!requestText && (
              <Button
                label="Read request"
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  try {
                    const request = parsePaymentRequest(requestText.trim());
                    setRecipient(request.recipient);
                    setAsset(request.asset);
                    setAmount(request.amount);
                    setNote(request.note);
                    setRequestText('');
                    setError(undefined);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Invalid request.');
                  }
                }}
              />
            )}
            {wallet.contacts.length > 0 && (
              <View className="gap-2">
                <Muted>Saved recipients</Muted>
                {wallet.contacts.slice(0, 5).map((contact) => (
                  <Button
                    key={contact.address}
                    variant="secondary"
                    label={`${contact.name} · ${shortAddress(contact.address)}`}
                    disabled={busy}
                    onPress={() => setRecipient(contact.address)}
                  />
                ))}
              </View>
            )}
            <View className="flex-row gap-2">
              {TRANSFER_ASSETS.map((code) => (
                <Pressable
                  key={code}
                  accessibilityRole="button"
                  accessibilityState={{ selected: code === asset }}
                  disabled={busy}
                  onPress={() => setAsset(code)}
                  className={cn(
                    'flex-1 items-center rounded-full border px-3 py-3',
                    code === asset ? 'border-brass bg-brass' : 'border-[#444]',
                  )}
                >
                  <AppText className={cn('font-outfit-semibold', code === asset ? 'text-[#111]' : 'text-paper')}>
                    {code}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <FormField
              label={t('vault.send.recipient')}
              value={recipient}
              onChangeText={setRecipient}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="G… / C…"
              maxLength={56}
            />
            <FormField
              label={t('vault.send.amount')}
              value={amount}
              onChangeText={setAmount}
              editable={!busy}
              keyboardType="decimal-pad"
              placeholder="0.00"
              maxLength={20}
            />
            <AppText className="text-sm text-muted">{t('vault.send.recipientHint')}</AppText>
            <FormField
              label="Private note (saved on this phone)"
              value={note}
              onChangeText={setNote}
              editable={!busy}
              maxLength={140}
            />
            {vault.error && <AppText className="text-sm text-danger">{t('vault.send.balanceUnavailable')}</AppText>}
          </View>
        )}
        {intent && (
          <View className="gap-3">
            <Muted>
              From {account.name} · {account.id}
            </Muted>
            <AppText className="font-outfit-semibold text-4xl">
              {intent.amount} {intent.asset}
            </AppText>
            <AppText className="text-xs text-muted">{t('vault.send.recipient')}</AppText>
            <AppText selectable className="text-base">
              {intent.recipient}
            </AppText>
            <InfoRows
              rows={[
                { label: t('vault.send.network'), value: 'Stellar Mainnet' },
                { label: t('vault.send.fee'), value: t('vault.send.sponsored') },
              ]}
            />
            {!!note && <Muted>Note: {note}</Muted>}
            {!saved && record?.state === 'prepared' && (
              <AppText className="text-sm text-muted">{t('vault.send.instructions')}</AppText>
            )}
            {pending && <AppText className="text-sm text-brass">{t('vault.send.pending')}</AppText>}
            {record?.message && <AppText className="text-sm text-muted">{record.message}</AppText>}
            {record?.hash && (
              <View className="gap-2">
                <AppText className="text-xs text-muted">{t('vault.send.transaction')}</AppText>
                <AppText selectable className="text-xs">
                  {record.hash}
                </AppText>
              </View>
            )}
            {record?.ledger && (
              <AppText className="text-sm text-muted">{t('vault.send.ledger', { ledger: record.ledger })}</AppText>
            )}
          </View>
        )}
        {message && <AppText className="mt-4 text-sm text-danger">{message}</AppText>}
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        {!restored ? (
          <Button
            label={busy ? t('vault.send.checking') : t('vault.send.checkStatus')}
            disabled={busy}
            onPress={restore}
          />
        ) : edit ? (
          <Button
            label={busy ? t('vault.send.preparing') : t('vault.send.review')}
            disabled={busy || !recipient || !amount}
            onPress={review}
          />
        ) : terminal ? (
          <Button label={t('vault.send.done')} disabled={busy} onPress={finish} />
        ) : saved ? (
          <Button
            label={busy ? t('vault.send.checking') : t('vault.send.checkStatus')}
            disabled={busy}
            onPress={check}
          />
        ) : (
          <Button
            icon="tap"
            label={busy ? t('vault.send.approving') : t('vault.send.approve')}
            disabled={busy}
            onPress={approve}
          />
        )}
        {!saved && record && (
          <Button
            variant="secondary"
            label={t('vault.send.edit')}
            disabled={busy}
            onPress={() => {
              setRecord(undefined);
              setReviewed(undefined);
            }}
          />
        )}
        {record?.state === 'confirmed' && (
          <Button
            variant="secondary"
            label={t('vault.send.balances')}
            disabled={busy}
            onPress={() => navigation.navigate('(screens)/vault/dashboard')}
          />
        )}
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
