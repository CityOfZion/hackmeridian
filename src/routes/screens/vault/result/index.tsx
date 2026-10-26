import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { View } from 'react-native';

import { AppText, Eyebrow } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { InfoRows } from '@/components/ui/info-rows';
import { Money } from '@/components/ui/money';
import { ResultBadge } from '@/components/ui/result-badge';
import { ASSET_CODE } from '@/constants';
import { useRequiredChipId } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { useGetCardsQuery } from '@/store/api/cards-api';
import { formatAmount } from '@/utils/format';

import type { TVaultResultScreenParams } from './types';

export function VaultResultScreen({ route }: StaticScreenProps<TVaultResultScreenParams>) {
  const navigation = useNavigation();
  const chipId = useRequiredChipId();
  const { cardId, amount, txHash } = route.params;
  // Refetched after the reload, so it carries the new limit
  const { data: cards } = useGetCardsQuery();

  if (!chipId) return null;

  const card = cards?.find((item) => item.id === cardId);

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>CARD RELOAD</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Reload</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="items-center pt-8">
          <ResultBadge icon="check" tone="success" />
          <Eyebrow>CONFIRMED BY YOUR PASS</Eyebrow>
          <AppText className="my-2.5 text-center font-outfit-semibold text-4xl tracking-tight">Card reloaded</AppText>
          <Money amount={amount} size="lg" className="font-outfit-semibold" />
        </View>
        {card && (
          <InfoRows
            rows={[
              { label: 'CARD', value: `${card.label.toUpperCase()} · •••• ${card.last4}` },
              { label: 'LOADED', value: `${formatAmount(card.loadedBalance)} ${ASSET_CODE}` },
              ...(txHash ? [{ label: 'STELLAR TX', value: `${txHash.slice(0, 8)}…${txHash.slice(-8)}` }] : []),
            ]}
          />
        )}
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        {/* Back gesture is off: the screens below are the amount and confirm steps of a finished reload */}
        <Button label="Done" onPress={() => navigation.dispatch(StackActions.popTo('(screens)/vault/dashboard'))} />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
