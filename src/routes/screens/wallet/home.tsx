import { useNavigation } from '@react-navigation/native';
import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Choice, Muted, Panel, SectionTitle } from '@/components/wallet/primitives';
import { useGetVaultQuery } from '@/store/api/vault-api';
import { apiErrorMessage } from '@/store/api/cards-api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectWallet, selectWalletAccount, updateWallet } from '@/store/slices/wallet-slice';
import { shortAddress } from '@/wallet/model';

export function WalletHome() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const wallet = useAppSelector(selectWallet);
  const account = useAppSelector(selectWalletAccount);
  const vault = useGetVaultQuery(account?.id ?? skipToken);
  const [error, setError] = useState<string>();
  const card = wallet.cards.find((c) => c.uid === account?.cardUid);
  if (!account)
    return (
      <View className="gap-6">
        <Panel className="border-brass">
          <AppText className="font-outfit-semibold text-4xl">Your money.\nYour Pass.</AppText>
          <Muted>
            Connect your ITEM card to open its Stellar account. Your private signing key stays on your card.
          </Muted>
        </Panel>
        <Button label="Connect a card" icon="tap" onPress={() => navigation.navigate('(screens)/scan')} />
        <Muted>
          Already paired on this phone? Your saved pairing key will be used automatically. Each card keychain has its
          own account.
        </Muted>
      </View>
    );
  return (
    <View className="gap-5">
      <Choice
        title={account.name}
        detail={`Stellar Mainnet · ${shortAddress(account.id)} · Change account`}
        onPress={() => navigation.navigate('(screens)/wallet/accounts')}
      />
      <Panel>
        <View className="flex-row items-center justify-between">
          <SectionTitle>Your balances</SectionTitle>
          <Button
            variant="secondary"
            label={wallet.hideBalances ? 'Show' : 'Hide'}
            onPress={async () => {
              try {
                await dispatch(updateWallet({ type: 'privacy', hideBalances: !wallet.hideBalances })).unwrap();
              } catch {
                setError('Could not save your privacy setting.');
              }
            }}
          />
        </View>
        {(['USDC', 'EURC', 'XLM'] as const).map((asset) => (
          <View key={asset} className="flex-row items-center justify-between border-b border-[#303033] py-3">
            <View>
              <AppText className="font-outfit-semibold text-lg">{asset}</AppText>
              <Muted>
                {asset === 'XLM' ? 'Stellar Lumens' : asset === 'USDC' ? 'USD Coin · Circle' : 'Euro Coin · Circle'}
              </Muted>
            </View>
            <AppText className="font-outfit-medium text-2xl">
              {wallet.hideBalances
                ? '••••'
                : vault.data
                  ? ((asset === 'XLM' ? vault.data.xlmBalance : vault.data.balances[asset])?.toLocaleString(undefined, {
                      maximumFractionDigits: 7,
                    }) ?? '—')
                  : '—'}
            </AppText>
          </View>
        ))}
        <Muted>
          {vault.isFetching
            ? 'Updating balances…'
            : vault.fulfilledTimeStamp
              ? `Updated ${new Date(vault.fulfilledTimeStamp).toLocaleTimeString()}`
              : 'Balances have not loaded yet.'}
        </Muted>
        {vault.error && <AppText className="text-danger">{apiErrorMessage(vault.error)}</AppText>}
        <Button
          label="Refresh balances"
          variant="secondary"
          disabled={vault.isFetching}
          onPress={() => {
            void vault.refetch();
          }}
        />
      </Panel>
      <View className="flex-row gap-2">
        <Button className="flex-1" label="Send" onPress={() => navigation.navigate('(screens)/vault/send', {})} />
        <Button
          className="flex-1"
          variant="secondary"
          label="Receive"
          onPress={() => navigation.navigate('(screens)/wallet/receive', { mode: 'receive' })}
        />
        <Button
          className="flex-1"
          variant="secondary"
          label="Request"
          onPress={() => navigation.navigate('(screens)/wallet/receive', { mode: 'request' })}
        />
      </View>
      <Panel>
        <SectionTitle>{card?.name ?? 'Your Pass'}</SectionTitle>
        <Muted>
          {card?.publicKey === account.publicKey
            ? 'This account matches the last verified keychain on your card.'
            : 'You are viewing another keychain. Sending requires its matching key to be active on the card.'}
        </Muted>
        <Muted>A fresh card signature approves every payment. Network fees are sponsored.</Muted>
      </Panel>
      <Button label="Contacts" variant="secondary" onPress={() => navigation.navigate('(screens)/wallet/contacts')} />
      {error && <AppText className="text-danger">{error}</AppText>}
    </View>
  );
}
