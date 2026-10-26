import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Money } from '@/components/ui/money';
import { ASSET_CODE } from '@/constants';
import { useRequiredSession, useVault } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';

const STELLAR_ACCOUNT = /^G[A-Z2-7]{55}$/;

/** Withdraw: `request_withdraw` to any Stellar account; it executes after the vault's withdraw delay. */
export function VaultWithdrawScreen() {
  const navigation = useNavigation();
  const session = useRequiredSession();
  const { data } = useVault(session?.userId);
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [touched, setTouched] = useState(false);

  if (!session) return null;

  const pending = (data?.activity ?? [])
    .filter((item) => item.kind === 'withdraw' && item.status === 'pending')
    .reduce((sum, item) => sum + item.amount, 0);
  const available = data ? data.vault.balance - pending : 0;
  const delayMinutes = data ? data.vault.withdrawDelayMs / 60_000 : undefined;
  const value = Number(amount.replace(',', '.'));
  const address = destination.trim().toUpperCase();

  const amountError =
    amount && !(value > 0) ? 'Enter an amount.' : value > available ? 'More than your available balance.' : undefined;
  const addressError =
    touched && address && !STELLAR_ACCOUNT.test(address) ? 'Enter a Stellar account address (G…).' : undefined;
  const valid = value > 0 && !amountError && STELLAR_ACCOUNT.test(address);

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>SPEND VAULT</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Withdraw</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="mb-6 border border-line bg-panel p-3.75">
          <AppText className="text-2xs tracking-widest text-muted">AVAILABLE</AppText>
          <Money amount={available} size="md" className="mt-1.25" />
        </View>

        <View className="gap-5">
          <View>
            <FormField
              label={`AMOUNT (${ASSET_CODE})`}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            {amountError && <AppText className="mt-2 text-xs text-danger">{amountError}</AppText>}
          </View>
          <View>
            <FormField
              label="TO STELLAR ACCOUNT"
              value={destination}
              onChangeText={setDestination}
              onBlur={() => setTouched(true)}
              placeholder="G…"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {addressError && <AppText className="mt-2 text-xs text-danger">{addressError}</AppText>}
          </View>
        </View>

        {delayMinutes !== undefined && (
          <AppText className="mt-5 text-xs leading-normal text-muted">
            {`Withdrawals execute ${delayMinutes} minutes after you confirm, so a pending operation can't be front-run. The account needs an ${ASSET_CODE} trustline.`}
          </AppText>
        )}

        {/* CTA stays in the body: the keyboard would cover a pinned footer */}
        <Button
          className="mt-6"
          icon="tap"
          label="Continue"
          disabled={!valid}
          onPress={() =>
            navigation.navigate('(screens)/vault/confirm', { action: 'withdraw', amount: value, destination: address })
          }
        />
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
