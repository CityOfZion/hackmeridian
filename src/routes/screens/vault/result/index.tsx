import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation(['screens', 'common']);
  const navigation = useNavigation();
  const chipId = useRequiredChipId();
  const { cardId, amount, txHash } = route.params;
  // Refetched after the fund, so it carries the new limit
  const { data: cards } = useGetCardsQuery();

  if (!chipId) return null;

  const card = cards?.find((item) => item.id === cardId);

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{t('vault.result.eyebrow')}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{t('vault.result.title')}</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="items-center pt-8">
          <ResultBadge icon="check" tone="success" />
          <Eyebrow>{t('vault.result.confirmed')}</Eyebrow>
          <AppText className="my-2.5 text-center font-outfit-semibold text-4xl tracking-tight">
            {t('vault.result.funded')}
          </AppText>
          <Money amount={amount} size="lg" className="font-outfit-semibold" />
        </View>
        {card && (
          <InfoRows
            rows={[
              { label: t('vault.result.card'), value: `${card.label.toUpperCase()} · •••• ${card.last4}` },
              { label: t('vault.result.loaded'), value: `${formatAmount(card.loadedBalance)} ${ASSET_CODE}` },
              ...(txHash
                ? [{ label: t('vault.result.stellarTx'), value: `${txHash.slice(0, 8)}…${txHash.slice(-8)}` }]
                : []),
            ]}
          />
        )}
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        {/* Back gesture is off: the screens below are the amount and confirm steps of a finished funding */}
        <Button
          label={t('common:actions.done')}
          onPress={() => navigation.dispatch(StackActions.popTo('(screens)/vault/dashboard'))}
        />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
