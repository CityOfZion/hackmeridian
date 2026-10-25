import { MERCHANT_NAME } from '@/constants';
import { transactionId } from '@/utils/ids';
import { selectSpentToday } from '@/store/selectors';
import { balanceDebited, selectHolderById } from '@/store/slices/holders-slice';
import { selectMerchantAcceptance, selectNetworkFrozen } from '@/store/slices/network-slice';
import { transactionRecorded, type DeclineReason, type Transaction } from '@/store/slices/transactions-slice';
import type { AppThunk } from '..';

/** Simulates a card tap at the merchant terminal; the card enforces state and daily limit. */
export const chargeCard =
  ({ holderId, amount }: { holderId: string; amount: number }): AppThunk<Transaction> =>
  (dispatch, getState) => {
    const state = getState();
    const holder = selectHolderById(state, holderId);
    const remaining = Math.max(0, holder.dailyLimit - selectSpentToday(state, holderId));

    let reason: DeclineReason | undefined;
    if (selectNetworkFrozen(state)) reason = 'NETWORK FROZEN';
    else if (!selectMerchantAcceptance(state)) reason = 'MERCHANT DISABLED';
    else if (holder.state === 'LOCKED') reason = 'CARD LOCKED';
    else if (holder.state === 'SUSPENDED') reason = 'CARD SUSPENDED';
    else if (amount > remaining) reason = 'OVER LIMIT';

    const transaction: Transaction = {
      id: transactionId(),
      holderId,
      merchant: MERCHANT_NAME,
      amount,
      createdAt: Date.now(),
      status: reason ? 'DECLINED' : 'SETTLED',
      reason,
    };

    dispatch(transactionRecorded(transaction));
    if (!reason) dispatch(balanceDebited({ id: holderId, amount }));
    return transaction;
  };
