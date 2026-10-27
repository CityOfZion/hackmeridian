import { setStringAsync } from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PassAccount } from '@/api/stellar/account';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { PAY_ASSETS } from '@/constants';
import { colors } from '@/theme/colors';
import { formatAmount } from '@/utils/format';

import { useAddTrustline } from './-use-add-trustline';

type Props = { chipId: string; account?: PassAccount; isLoading: boolean; error?: string };

/**
 * Vault balances (EURC and USDC) read from the Pass's Stellar account, that account's address with a copy button, and
 * a button per asset the account has no trustline for yet.
 */
export function VaultAccount({ chipId, account, isLoading, error }: Props) {
  const { t } = useTranslation(['screens', 'common']);
  const [copied, setCopied] = useState(false);
  const trustline = useAddTrustline(chipId);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const missing = account?.exists ? PAY_ASSETS.filter((code) => account.balances[code] === null) : [];
  const status = !account
    ? undefined
    : !account.exists
      ? t('vault.dashboard.notOnStellar')
      : missing.length
        ? t('vault.dashboard.needsTrustline', { assets: missing.join(', ') })
        : undefined;

  return (
    <View className="items-center pb-2">
      <AppText className="text-2xs tracking-widest text-muted">{t('vault.dashboard.balance')}</AppText>
      {isLoading ? (
        <ActivityIndicator className="mt-3" color={colors.brass} />
      ) : (
        <View className="mt-1.25 flex-row flex-wrap justify-center gap-x-6">
          {PAY_ASSETS.map((code) => (
            <Money
              key={code}
              amount={account?.balances[code] ?? 0}
              size="xl"
              unit={code}
              className="font-outfit-semibold"
            />
          ))}
        </View>
      )}
      {account && <AppText className="mt-1 text-xs text-muted">{`${formatAmount(account.xlmBalance)} XLM`}</AppText>}
      {error && <AppText className="mt-1 text-center text-sm text-danger">{error}</AppText>}
      {account && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('vault.dashboard.copyAddress')}
          accessibilityHint={account.address}
          onPress={async () => {
            await setStringAsync(account.address);
            setCopied(true);
          }}
          className="mt-3 flex-row items-center gap-2 rounded-full border border-[#333] py-2 pr-3 pl-4 active:opacity-70"
        >
          <AppText className="font-outfit-medium text-3xs tracking-widest text-[#ccc]">
            {copied
              ? t('vault.dashboard.addressCopied')
              : `${account.address.slice(0, 6)}…${account.address.slice(-6)}`}
          </AppText>
          <Icon name={copied ? 'check' : 'copy'} size={16} />
        </Pressable>
      )}
      {status && <AppText className="mt-2 text-center text-2xs text-muted">{status}</AppText>}
      {missing.map((code) => (
        <Button
          key={code}
          variant="secondary"
          icon="tap"
          label={
            trustline.pending !== code
              ? t('vault.dashboard.addTrustline', { asset: code })
              : trustline.isTapping
                ? t('common:tap.holdStill')
                : t('vault.dashboard.addingTrustline', { asset: code })
          }
          disabled={trustline.isTapping || trustline.isSubmitting}
          onPress={() => trustline.addTrustline(code)}
          className="mt-3 self-stretch"
        />
      ))}
      {trustline.error && <AppText className="mt-2 text-center text-sm text-danger">{trustline.error}</AppText>}
    </View>
  );
}
