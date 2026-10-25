import { CURRENT_HOLDER_ID } from '../constants';
import { useAppSelector } from '../store/hooks';
import { selectHolderTransactions, selectSpentToday } from '../store/selectors';
import { selectHolderById } from '../store/slices/holders-slice';

/** The holder operated by the Card Holder role, with today's spend figures. */
export function useCurrentHolder() {
  const holder = useAppSelector((state) => selectHolderById(state, CURRENT_HOLDER_ID));
  const spentToday = useAppSelector((state) => selectSpentToday(state, CURRENT_HOLDER_ID));
  const transactions = useAppSelector((state) => selectHolderTransactions(state, CURRENT_HOLDER_ID));
  const remainingToday = Math.max(0, holder.dailyLimit - spentToday);
  return { holder, spentToday, remainingToday, transactions };
}
