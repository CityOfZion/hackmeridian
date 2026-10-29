import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Modal, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { hydrateWallet, walletLocked, walletUnlocked } from '@/store/slices/wallet-slice';
import { authenticateDevice } from '@/wallet/device-auth';
import { cardPinSession } from '@/api/item/pin-session';
import { migrateWallet } from '@/wallet/migrate';

export function WalletGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { ready, locked, data } = useAppSelector((state) => state.wallet);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [covered, setCovered] = useState(AppState.currentState !== 'active');
  const load = () =>
    migrateWallet()
      .then(() => dispatch(hydrateWallet()).unwrap())
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not open saved wallet.'))
      .finally(() => setBusy(false));
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setCovered(state !== 'active');
      if (state === 'background' && data.appLock) dispatch(walletLocked());
    });
    return () => sub.remove();
  }, [data.appLock, dispatch]);

  useEffect(() => {
    if (locked) cardPinSession.clear();
  }, [locked]);

  const unlock = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await authenticateDevice('Unlock VaultPass');
      dispatch(walletUnlocked());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to unlock.');
    } finally {
      setBusy(false);
    }
  };
  const panel = (
    <View className="flex-1 justify-center gap-5 bg-ink px-8">
      <AppText className="font-outfit-semibold text-4xl">VaultPass</AppText>
      <AppText className="text-base text-muted">
        {ready ? 'Your wallet is locked on this device.' : 'Opening your saved wallet…'}
      </AppText>
      {error && (
        <AppText accessibilityRole="alert" className="text-danger">
          {error}
        </AppText>
      )}
      <Button
        label={busy ? 'Please wait…' : ready ? 'Unlock wallet' : 'Try again'}
        disabled={busy || (!ready && !error)}
        onPress={
          ready
            ? unlock
            : () => {
                setBusy(true);
                setError(undefined);
                void load();
              }
        }
      />
    </View>
  );
  if (!ready) return panel;
  return (
    <>
      {children}
      <Modal visible={locked && data.appLock} animationType="none" onRequestClose={() => {}}>
        {panel}
      </Modal>
      {covered && !locked && (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center bg-ink">
          <AppText className="text-3xl">VaultPass</AppText>
        </View>
      )}
    </>
  );
}
