import { useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { CARD_ASSET_CODE, MAX_FUND, PAY_ASSETS, type PayAsset } from '@/constants';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRequiredChipId } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { apiErrorMessage, useGetCardsQuery } from '@/store/api/cards-api';
import { useGetFundQuoteQuery, useGetVaultQuery } from '@/store/api/vault-api';
import { cn } from '@/utils/cn';
import { formatAmount } from '@/utils/format';

import { applyKey, Keypad } from './-keypad';
import type { TVaultFundScreenParams } from './types';

/**
 * Fund a card: the amount is EURC (the card's EUR limit rises by it). The vault pays with EURC (1:1) or USDC,
 * converted on Stellar's exchange, quoted live as the amount is typed.
 */
export function VaultFundScreen({ route }: StaticScreenProps<TVaultFundScreenParams>) {
  const { t } = useTranslation(['screens', 'common']);
  const navigation = useNavigation();
  const chipId = useRequiredChipId();
  const { cardId } = route.params;
  const { data: vault } = useGetVaultQuery(chipId ?? skipToken);
  const { data: cards } = useGetCardsQuery();
  const [amount, setAmount] = useState('');
  const [choice, setChoice] = useState<PayAsset>();
  // Until the user picks: EURC when the vault has some (no conversion), else USDC
  const payWith = choice ?? ((vault?.balances.EURC ?? 0) > 0 || !vault?.balances.USDC ? 'EURC' : 'USDC');
  const converts = payWith !== CARD_ASSET_CODE;
  const balance = vault?.balances[payWith];
  const available = balance ?? 0;
  const value = Number(amount);
  const quotedValue = useDebouncedValue(value);
  const quote = useGetFundQuoteQuery(
    converts && quotedValue > 0 && quotedValue <= MAX_FUND ? { amount: quotedValue, payWith } : skipToken,
  );
  // EURC pays 1:1; a USDC quote matches what's on screen only once typing has settled
  const cost = !converts ? value : quotedValue === value ? quote.data?.sourceAmount : undefined;

  if (!chipId) return null;

  const card = cards?.find((item) => item.id === cardId);
  const assets = { asset: CARD_ASSET_CODE, vault: payWith };
  const tooMuch = cost !== undefined && cost > available;
  const hint =
    balance === null
      ? t('vault.fund.noTrustline', assets)
      : value > MAX_FUND
        ? t('vault.fund.max', { max: MAX_FUND, asset: CARD_ASSET_CODE })
        : !value || !converts
          ? tooMuch
            ? t('vault.fund.tooMuch', { ...assets, cost: formatAmount(value) })
            : t('vault.fund.available', { amount: formatAmount(available), asset: payWith })
          : quote.error && cost === undefined && quotedValue === value
            ? apiErrorMessage(quote.error)
            : cost === undefined
              ? t('vault.fund.quoting', assets)
              : tooMuch
                ? t('vault.fund.tooMuch', { ...assets, cost: formatAmount(cost) })
                : t('vault.fund.cost', { ...assets, cost: formatAmount(cost), available: formatAmount(available) });

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
            {amount || '0.00'} <AppText className="text-lg text-[#2d2a0b]">{CARD_ASSET_CODE}</AppText>
          </AppText>
          <AppText className="mt-3 text-2xs text-[#2d2a0b]">{hint}</AppText>
        </View>
        <View className="mb-4.5 flex-row items-center gap-2">
          <AppText className="mr-1 text-2xs tracking-widest text-muted">{t('vault.fund.payWith')}</AppText>
          {PAY_ASSETS.map((code) => (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityState={{ selected: payWith === code }}
              onPress={() => setChoice(code)}
              className={cn(
                'flex-1 items-center rounded-full border py-2.5 active:opacity-70',
                payWith === code ? 'border-brass bg-brass' : 'border-[#444]',
              )}
            >
              <AppText className={cn('font-outfit-semibold text-sm', payWith === code ? 'text-[#111]' : 'text-paper')}>
                {code}
              </AppText>
              <AppText className={cn('text-3xs', payWith === code ? 'text-[#2d2a0b]' : 'text-muted')}>
                {formatAmount(vault?.balances[code] ?? 0)}
              </AppText>
            </Pressable>
          ))}
        </View>
        <Keypad onKeyPress={(key) => setAmount((current) => applyKey(current, key))} />
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button
          icon="tap"
          label={t('common:actions.continue')}
          disabled={!card || !value || value > MAX_FUND || balance == null || cost === undefined || tooMuch}
          onPress={() => navigation.navigate('(screens)/vault/confirm', { cardId, amount: value, payWith })}
        />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
