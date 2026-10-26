import { useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ASSET_CODE, MAX_FUND } from '@/constants';
import { useRequiredChipId } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { useGetCardsQuery } from '@/store/api/cards-api';
import { useGetVaultQuery } from '@/store/api/vault-api';
import { formatAmount } from '@/utils/format';

import { applyKey, Keypad } from './-keypad';
import type { TVaultFundScreenParams } from './types';

/** Fund a card: raise the bunq limit of the card picked on the dashboard, paid from the Pass's on-chain EURC. */
export function VaultFundScreen({ route }: StaticScreenProps<TVaultFundScreenParams>) {
  const { t } = useTranslation(['screens', 'common']);
  const navigation = useNavigation();
  const chipId = useRequiredChipId();
  const { cardId } = route.params;
  const { data: vault } = useGetVaultQuery(chipId ?? skipToken);
  const available = vault?.balance ?? 0;
  const { data: cards } = useGetCardsQuery();
  const [amount, setAmount] = useState('');

  if (!chipId) return null;

  const card = cards?.find((item) => item.id === cardId);
  const value = Number(amount);
  const hint =
    value > MAX_FUND
      ? t('vault.fund.max', { max: MAX_FUND, asset: ASSET_CODE })
      : value > available
        ? t('vault.fund.tooMuch')
        : t('vault.fund.available', { amount: formatAmount(available), asset: ASSET_CODE });

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>
            {card ? `${card.label} · •••• ${card.last4}` : t('vault.fund.eyebrow')}
          </ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{t('vault.fund.title')}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="mb-5.5 items-center rounded-lg bg-brass pt-8.75 pb-7">
          <AppText className="text-2xs tracking-widest text-[#2d2a0b]">{t('vault.fund.amount')}</AppText>
          <AppText className="mt-3 font-outfit-semibold text-5xl leading-none tracking-tighter text-[#111]">
            {amount || '0.00'} <AppText className="text-lg text-[#2d2a0b]">{ASSET_CODE}</AppText>
          </AppText>
          <AppText className="mt-3 text-2xs text-[#2d2a0b]">{hint}</AppText>
        </View>
        <Keypad onKeyPress={(key) => setAmount((current) => applyKey(current, key))} />
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button
          icon="tap"
          label={t('common:actions.continue')}
          disabled={!card || !value || value > MAX_FUND || value > available}
          onPress={() => navigation.navigate('(screens)/vault/confirm', { cardId, amount: value })}
        />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
