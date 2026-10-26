import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Eyebrow } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { InfoRows, type InfoRow } from '@/components/ui/info-rows';
import { Money } from '@/components/ui/money';
import { ResultBadge } from '@/components/ui/result-badge';
import { useRequiredSession, useVault } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { colors } from '@/theme/colors';
import { formatClock, shortAddress } from '@/utils/format';

import type { TVaultResultScreenParams } from './types';

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`.toUpperCase();
}

export function VaultResultScreen({ route }: StaticScreenProps<TVaultResultScreenParams>) {
  const navigation = useNavigation();
  const session = useRequiredSession();
  const { data } = useVault(session?.userId);
  const activity = data?.activity.find((item) => item.id === route.params.activityId);

  if (!session) return null;

  const withdraw = activity?.kind === 'withdraw';
  const pending = activity?.status === 'pending';
  const rows: InfoRow[] = activity
    ? [
        { label: 'TIME', value: formatClock(activity.createdAt) },
        { label: 'REFERENCE', value: activity.id },
        ...(activity.destination ? [{ label: 'TO', value: shortAddress(activity.destination) }] : []),
        ...(pending && activity.availableAt
          ? [{ label: 'EXECUTES AT', value: formatClock(activity.availableAt) }]
          : []),
        ...(activity.txHash ? [{ label: 'STELLAR TX', value: shortHash(activity.txHash) }] : []),
      ]
    : [];

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>SPEND VAULT</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{withdraw ? 'Withdrawal' : 'Reload'}</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        {!activity ? (
          <ActivityIndicator className="mt-12" color={colors.brass} />
        ) : (
          <>
            <View className="items-center pt-8">
              <ResultBadge icon={pending ? 'clock' : 'check'} tone={pending ? 'brass' : 'success'} />
              <Eyebrow>{pending ? 'WITHDRAWAL REQUESTED' : 'SIGNED BY YOUR PASS'}</Eyebrow>
              <AppText className="my-2.5 text-center font-outfit-semibold text-4xl tracking-tight">
                {withdraw ? (pending ? 'On its way' : 'Withdrawn') : 'Vault reloaded'}
              </AppText>
              <Money amount={activity.amount} size="lg" className="font-outfit-semibold" />
              {pending && (
                <AppText className="mt-3 text-center text-sm text-muted">
                  It executes after the withdraw delay. You can follow it on the dashboard.
                </AppText>
              )}
            </View>
            <InfoRows rows={rows} />
          </>
        )}
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        {/* Back gesture is off: the screens below are the amount and confirm steps of a finished operation */}
        <Button label="Done" onPress={() => navigation.dispatch(StackActions.popTo('(screens)/vault/dashboard'))} />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
