import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';

import { PhysicalCard } from '@/components/card/physical-card';
import { ActivityRow } from '@/components/rows/activity-row';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { SectionTitle } from '@/components/ui/section-title';
import { ScreenLayout } from '@/layouts/screen-layout';
import { useRequiredSession, useVault } from '@/hooks/use-session';
import { apiErrorMessage } from '@/store/api/vault-api';
import { colors } from '@/theme/colors';
import { formatAmount, greeting, shortAddress } from '@/utils/format';

/** Ticks every second while `active`, for withdrawal countdowns. */
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export function VaultDashboardScreen() {
  const navigation = useNavigation();
  const session = useRequiredSession();
  const { data, error, isLoading, refetch } = useVault(session?.userId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pending = data?.activity.filter((item) => item.kind === 'withdraw' && item.status === 'pending') ?? [];
  const now = useNow(pending.length > 0);

  if (!session) return null;

  const pendingTotal = pending.reduce((sum, item) => sum + item.amount, 0);
  const vault = data?.vault;
  const frozen = vault?.status === 'frozen';

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>SPEND VAULT</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{`${greeting()}, ${session.name.split(' ')[0]}`}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton
          icon="logout"
          accessibilityLabel="Sign out"
          onPress={() => navigation.navigate('(drawers)/session/sign-out')}
        />
      </ScreenLayout.Header>
      <ScreenLayout.Body
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.brass}
            onRefresh={async () => {
              // Not isFetching: polling would spin the indicator every few seconds
              setIsRefreshing(true);
              await refetch();
              setIsRefreshing(false);
            }}
          />
        }
      >
        <PhysicalCard state={frozen ? 'FROZEN' : 'ACTIVE'} holderName={session.name} />

        {isLoading && <ActivityIndicator className="mt-8" color={colors.brass} />}
        {error && !data && <AppText className="mt-6 text-sm text-danger">{apiErrorMessage(error)}</AppText>}

        {vault && data && (
          <>
            <View className="flex-row items-end justify-between py-5.5">
              <View>
                <AppText className="text-2xs tracking-widest text-muted">VAULT BALANCE</AppText>
                <Money amount={vault.balance} size="xl" className="mt-1.25 font-outfit-semibold" />
              </View>
              <AppText className="text-3xs text-muted">{shortAddress(vault.contractId)}</AppText>
            </View>

            {pendingTotal > 0 && (
              <View className="mb-3 border border-line bg-panel p-3.75">
                <View className="flex-row justify-between">
                  <AppText className="text-2xs tracking-widest text-muted">AVAILABLE</AppText>
                  <AppText className="font-outfit-semibold text-xs">
                    {formatAmount(vault.balance - pendingTotal)}
                  </AppText>
                </View>
                <AppText className="mt-2 text-2xs text-[#777]">
                  {formatAmount(pendingTotal)} EURC waiting for the withdraw delay
                </AppText>
              </View>
            )}

            <View className="flex-row gap-2.25">
              <Button
                className="flex-1"
                icon="down"
                label="Reload"
                disabled={frozen}
                onPress={() => navigation.navigate('(screens)/vault/reload')}
              />
              <Button
                className="flex-1"
                icon="up"
                variant="secondary"
                label="Withdraw"
                disabled={frozen || vault.balance - pendingTotal <= 0}
                onPress={() => navigation.navigate('(screens)/vault/withdraw')}
              />
            </View>
            {frozen && (
              <AppText className="mt-3 text-xs text-[#d37a7a]">
                Your vault is frozen. Reloads and withdrawals are paused.
              </AppText>
            )}

            <SectionTitle title="Activity" />
            {data.activity.length === 0 ? (
              <AppText className="text-sm text-muted">No activity yet. Reload to fund your vault.</AppText>
            ) : (
              data.activity.map((item) => <ActivityRow key={item.id} activity={item} now={now} />)
            )}
          </>
        )}
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
