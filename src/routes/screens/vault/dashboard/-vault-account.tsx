import { setStringAsync } from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import type { PassAccount } from '@/api/stellar/account';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { colors } from '@/theme/colors';
import { formatAmount } from '@/utils/format';

import { useAddTrustline } from './-use-add-trustline';

type Props = { chipId: string; account?: PassAccount; isLoading: boolean; error?: string };

/**
 * Vault balance read from the Pass's Stellar account, that account's address with a copy button, and the button that
 * adds its USDC trustline when it has none.
 */
export function VaultAccount({ chipId, account, isLoading, error }: Props) {
  const [copied, setCopied] = useState(false);
  const trustline = useAddTrustline(chipId);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const status = !account
    ? undefined
    : !account.exists
      ? 'Not on Stellar yet: send XLM to this address to open it.'
      : !account.hasTrustline
        ? 'This account needs a USDC trustline before it can hold or send USDC.'
        : undefined;

  return (
    <View className="items-center pb-2">
      <AppText className="text-2xs tracking-widest text-muted">VAULT BALANCE</AppText>
      {isLoading ? (
        <ActivityIndicator className="mt-3" color={colors.brass} />
      ) : (
        <Money amount={account?.balance ?? 0} size="2xl" className="mt-1.25 font-outfit-semibold" />
      )}
      {account && <AppText className="mt-1 text-xs text-muted">{`${formatAmount(account.xlmBalance)} XLM`}</AppText>}
      {error && <AppText className="mt-1 text-center text-sm text-danger">{error}</AppText>}
      {account && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy your Pass's Stellar address"
          accessibilityHint={account.address}
          onPress={async () => {
            await setStringAsync(account.address);
            setCopied(true);
          }}
          className="mt-3 flex-row items-center gap-2 rounded-full border border-[#333] py-2 pr-3 pl-4 active:opacity-70"
        >
          <AppText className="font-outfit-medium text-3xs tracking-widest text-[#ccc]">
            {copied ? 'ADDRESS COPIED' : `${account.address.slice(0, 6)}…${account.address.slice(-6)}`}
          </AppText>
          <Icon name={copied ? 'check' : 'copy'} size={16} />
        </Pressable>
      )}
      {status && <AppText className="mt-2 text-center text-2xs text-muted">{status}</AppText>}
      {account?.exists && !account.hasTrustline && (
        <Button
          variant="secondary"
          icon="tap"
          label={
            trustline.isTapping
              ? 'Hold your Pass still…'
              : trustline.isSubmitting
                ? 'Adding USDC trustline…'
                : 'Add USDC trustline'
          }
          disabled={trustline.isTapping || trustline.isSubmitting}
          onPress={trustline.addTrustline}
          className="mt-3 self-stretch"
        />
      )}
      {trustline.error && <AppText className="mt-2 text-center text-sm text-danger">{trustline.error}</AppText>}
    </View>
  );
}
