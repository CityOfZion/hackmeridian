import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { accountActivity, type AccountEvent, type ActivityPage } from '@/api/stellar/activity';
import { transferStatus } from '@/api/stellar/transfer';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Choice, Muted, Panel, SectionTitle } from '@/components/wallet/primitives';
import { useAppSelector } from '@/store/hooks';
import { selectWalletAccount } from '@/store/slices/wallet-slice';
import { readReceipts, recordReceipt, type Receipt } from '@/wallet/receipts';
import { shortAddress, type WalletAccount } from '@/wallet/model';

export function WalletActivity() {
  const account = useAppSelector(selectWalletAccount);
  return account ? (
    <AccountActivity key={account.id} account={account} />
  ) : (
    <Muted>Connect a card to view account activity.</Muted>
  );
}
function AccountActivity({ account }: { account: WalletAccount }) {
  const navigation = useNavigation();
  const [events, setEvents] = useState<AccountEvent[]>([]);
  const [page, setPage] = useState<ActivityPage>();
  const [latestLoaded, setLatestLoaded] = useState<number>();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [expanded, setExpanded] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const refresh = useCallback(
    (cursor?: string, beforeLedger?: number) =>
      readReceipts(account.id)
        .then((records) => {
          setReceipts(records);
          setError(undefined);
          return accountActivity(account, cursor, beforeLedger);
        })
        .then((next) => {
          if (!beforeLedger) setLatestLoaded(next.endLedger - 1);
          setPage(next);
          setEvents((previous) =>
            [...new Map([...(beforeLedger ? previous : []), ...next.events].map((e) => [e.id, e])).values()].sort(
              (a, b) => b.id.localeCompare(a.id),
            ),
          );
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load activity.'))
        .finally(() => setBusy(false)),
    [account],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const explorer = (hash: string) => {
    if (/^[0-9a-f]{64}$/.test(hash))
      void Linking.openURL(`https://stellar.expert/explorer/public/tx/${hash}`).catch(() =>
        setError('Could not open the explorer.'),
      );
  };
  return (
    <View className="gap-4">
      <Choice
        title={account.name}
        detail={shortAddress(account.id)}
        onPress={() => navigation.navigate('(screens)/wallet/accounts')}
      />
      <View className="flex-row gap-2">
        {(['all', 'sent', 'received'] as const).map((value) => (
          <Button
            className="flex-1"
            key={value}
            label={value === 'all' ? 'All' : value === 'sent' ? 'Sent' : 'Received'}
            variant={filter === value ? 'primary' : 'secondary'}
            onPress={() => setFilter(value)}
          />
        ))}
      </View>
      <Button
        variant="secondary"
        label={busy ? 'Updating…' : 'Refresh activity'}
        disabled={busy}
        onPress={() => {
          setBusy(true);
          void refresh();
        }}
      />
      {error && (
        <AppText accessibilityRole="alert" className="text-danger">
          {error}
        </AppText>
      )}
      <Muted>
        {page
          ? `History loaded from ledger ${page.startLedger} to ${latestLoaded}. ${page.hasMore ? 'This range has more events; load the next page.' : 'All events in this range loaded.'} Older history is limited by the RPC provider’s retention.`
          : 'Recent on-chain transfers and payments saved on this phone. This is not a full lifetime statement.'}
      </Muted>
      {filter !== 'received' &&
        receipts
          .filter((r) => !r.hash || !events.some((e) => e.hash === r.hash))
          .map((receipt) => (
            <Panel key={receipt.prepared.id}>
              <SectionTitle>
                {receipt.intent.amount} {receipt.intent.asset} · {receipt.state}
              </SectionTitle>
              <Muted>
                To {shortAddress(receipt.intent.recipient)} · {new Date(receipt.recordedAt).toLocaleString()}
              </Muted>
              {receipt.note && <Muted>Private note: {receipt.note}</Muted>}
              {!['confirmed', 'failed', 'expired'].includes(receipt.state) && (
                <>
                  <Button
                    variant="secondary"
                    label="Check payment status"
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      try {
                        const record = await transferStatus(receipt.prepared.id);
                        if (record.prepared.account !== account.id) throw new Error('Payment account mismatch.');
                        await recordReceipt(record);
                        setReceipts(await readReceipts(account.id));
                        setError(undefined);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Could not check payment.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  <Button
                    label="Open pending payment"
                    onPress={() => navigation.navigate('(screens)/vault/send', {})}
                  />
                </>
              )}
              {receipt.hash && (
                <Button variant="secondary" label="View transaction" onPress={() => explorer(receipt.hash!)} />
              )}
            </Panel>
          ))}
      {events
        .filter((e) => filter === 'all' || e.direction === filter)
        .map((event) => (
          <Panel key={event.id}>
            <Choice
              title={`${event.direction === 'sent' ? '−' : '+'}${event.amount} ${event.asset}`}
              detail={`${event.direction === 'sent' ? 'To' : 'From'} ${shortAddress(event.direction === 'sent' ? event.to : event.from)} · ${new Date(event.date).toLocaleDateString()}`}
              onPress={() => setExpanded(expanded === event.id ? undefined : event.id)}
            />
            {expanded === event.id && (
              <>
                <Muted>Confirmed · Ledger {event.ledger}</Muted>
                <AppText selectable className="text-xs">
                  From: {event.from}
                  {'\n'}To: {event.to}
                  {'\n'}Transaction: {event.hash}
                </AppText>
                <Button variant="secondary" label="View transaction" onPress={() => explorer(event.hash)} />
              </>
            )}
          </Panel>
        ))}
      {page?.hasMore && (
        <Button
          label="Load more events"
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void refresh(page.cursor, page.endLedger);
          }}
        />
      )}
      {page && !page.hasMore && page.startLedger > page.oldestLedger && (
        <Button
          label="Load earlier history"
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void refresh(undefined, page.startLedger);
          }}
        />
      )}
      {page && events.length === 0 && receipts.length === 0 && (
        <Panel>
          <SectionTitle>No transfers in this history window</SectionTitle>
          <Muted>Receive funds or approve a payment to see activity here.</Muted>
        </Panel>
      )}
    </View>
  );
}
