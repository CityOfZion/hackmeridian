import { Address, Asset, Networks, scValToNative, xdr } from '@stellar/stellar-sdk';
import { TransferError } from './transfer-service.mjs';

const assets = [
  Asset.native(),
  new Asset('USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'),
  new Asset('EURC', 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2'),
];
export const activityAssets = new Map(
  assets.map((asset) => [asset.contractId(Networks.PUBLIC), asset.isNative() ? 'XLM' : asset.getCode()]),
);
export function decodeActivity(event, account) {
  const asset = activityAssets.get(event.contractId?.contractId());
  if (!asset || event.type !== 'contract' || event.inSuccessfulContractCall === false) return null;
  const topics = event.topic.map(scValToNative);
  if (![3, 4].includes(topics.length) || topics[0] !== 'transfer') return null;
  const [, from, to] = topics;
  if (from !== account && to !== account) return null;
  const units = scValToNative(event.value);
  if (typeof units !== 'bigint' || units < 0n) throw new Error('Unexpected token event amount');
  const amount = `${units / 10_000_000n}.${(units % 10_000_000n).toString().padStart(7, '0')}`.replace(/\.?0+$/, '');
  return {
    id: event.id,
    account,
    asset,
    amount,
    from,
    to,
    direction: from === account ? 'sent' : 'received',
    hash: event.txHash,
    ledger: event.ledger,
    date: event.ledgerClosedAt,
  };
}

/** Read only. Coverage is explicit: RPC retention is bounded and pages may remain. */
export async function accountActivity(rpc, account, cursor, beforeLedger) {
  if (cursor !== undefined && (typeof cursor !== 'string' || !/^[0-9-]{1,128}$/.test(cursor)))
    throw new TransferError('Invalid activity cursor');
  const health = await rpc.getHealth();
  if (!Number.isSafeInteger(health.oldestLedger) || !Number.isSafeInteger(health.latestLedger))
    throw new Error('RPC retention window unavailable');
  const endLedger = beforeLedger ?? health.latestLedger + 1;
  if (!Number.isSafeInteger(endLedger) || endLedger <= health.oldestLedger || endLedger > health.latestLedger + 1)
    throw new TransferError('History range is outside RPC retention. Refresh activity.');
  const startLedger = Math.max(health.oldestLedger, endLedger - 1024);
  const transfer = xdr.ScVal.scvSymbol('transfer').toXDR('base64');
  const address = Address.fromString(account).toScVal().toXDR('base64');
  const filters = [
    {
      type: 'contract',
      contractIds: [...activityAssets.keys()],
      topics: [
        [transfer, address, '*'],
        [transfer, '*', address],
        [transfer, address, '*', '*'],
        [transfer, '*', address, '*'],
      ],
    },
  ];
  const page = await rpc.getEvents({
    filters,
    limit: 100,
    ...(cursor ? { cursor } : { startLedger, endLedger }),
  });
  const events = new Map();
  for (const event of page.events) {
    if (event.ledger < startLedger || event.ledger >= endLedger) continue;
    const decoded = decodeActivity(event, account);
    if (decoded) events.set(decoded.id, decoded);
  }
  return {
    account,
    events: [...events.values()].sort((a, b) => b.id.localeCompare(a.id)),
    oldestLedger: health.oldestLedger,
    latestLedger: page.latestLedger,
    startLedger,
    endLedger,
    cursor: page.cursor,
    hasMore: page.events.length === 100 && page.events.at(-1).ledger < endLedger,
  };
}
