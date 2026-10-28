import type { StaticScreenProps } from '@react-navigation/native';
import { setStringAsync } from 'expo-clipboard';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { TRANSFER_ASSETS, type TransferAsset } from '@/api/stellar/transfer-codec';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Choice, Muted, Panel } from '@/components/wallet/primitives';
import { QrCode } from '@/components/wallet/qr-code';
import { ScreenLayout } from '@/layouts/screen-layout';
import { useAppSelector } from '@/store/hooks';
import { selectWalletAccount } from '@/store/slices/wallet-slice';
import { paymentRequest } from '@/wallet/model';

export function WalletReceiveScreen({ route }: StaticScreenProps<{ mode: 'receive' | 'request' }>) {
  const account = useAppSelector(selectWalletAccount);
  const request = route.params.mode === 'request';
  const [asset, setAsset] = useState<TransferAsset>('XLM');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string>();
  let value: string | undefined;
  let error: string | undefined;
  try {
    if (account) value = request ? paymentRequest(account.id, asset, amount, note) : account.id;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Invalid request.';
  }
  const share = async (copy: boolean) => {
    if (!value) return;
    try {
      if (copy) {
        await setStringAsync(value);
        setStatus('Copied');
      } else await Share.share({ message: request ? value : `Receive ${asset} on Stellar Mainnet\n${value}` });
    } catch {
      setStatus('Could not share. Please try again.');
    }
  };
  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{account?.name ?? 'Wallet'}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{request ? 'Request money' : 'Receive money'}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="gap-4">
          {!account ? (
            <Muted>Connect a card to receive funds.</Muted>
          ) : (
            <>
              <View className="flex-row gap-2">
                {TRANSFER_ASSETS.map((code) => (
                  <View key={code} className="flex-1">
                    <Choice
                      title={code}
                      selected={asset === code}
                      onPress={() => {
                        setAsset(code);
                        setStatus(undefined);
                      }}
                    />
                  </View>
                ))}
              </View>
              {request && (
                <>
                  <FormField
                    label={`Amount in ${asset}`}
                    value={amount}
                    onChangeText={(v) => {
                      setAmount(v.replace(',', '.'));
                      setStatus(undefined);
                    }}
                    keyboardType="decimal-pad"
                    maxLength={20}
                  />
                  <FormField
                    label="Request note (shared with the recipient)"
                    value={note}
                    onChangeText={(v) => {
                      setNote(v);
                      setStatus(undefined);
                    }}
                    maxLength={140}
                  />
                </>
              )}
              {value && (
                <Panel className="bg-white">
                  <QrCode value={value} />
                </Panel>
              )}
              <AppText selectable className="text-center text-sm">
                {account.id}
              </AppText>
              <Muted>
                Stellar Mainnet · {asset}
                {asset === 'XLM' ? '' : ' issued by Circle'}. This is a Soroban C address. Use a wallet or exchange that
                supports transfers to smart accounts. No memo is required.
              </Muted>
              {request && (
                <Muted>
                  This QR is a VaultPass payment request. Open it in VaultPass or paste it into Send. The recipient
                  reviews the amount before approving. The note is not written on-chain.
                </Muted>
              )}
              {error && amount !== '' && <AppText className="text-danger">{error}</AppText>}
              {status && (
                <AppText accessibilityRole="alert" className="text-brass">
                  {status}
                </AppText>
              )}
            </>
          )}
        </View>
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button
          label={request ? 'Share request' : 'Share address'}
          disabled={!value}
          onPress={() => {
            void share(false);
          }}
        />
        <Button
          label={request ? 'Copy request' : 'Copy address'}
          variant="secondary"
          disabled={!value}
          onPress={() => {
            void share(true);
          }}
        />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
