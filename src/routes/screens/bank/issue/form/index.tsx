import type { CardInfo } from '@item-systems/item/mobile';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';

import { CardDesignPicker } from '@/components/card/card-design-picker';
import { PhysicalCard } from '@/components/card/physical-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { InfoRows } from '@/components/ui/info-rows';
import { ScreenLayout } from '@/layouts/screen-layout';
import { StatusPill } from '@/components/ui/status-pill';
import { DEFAULT_DAILY_LIMIT, NETWORK_NAME } from '@/constants';
import { NfiScanError, useScanItemNfi } from '@/hooks/use-item-nfi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { cardIssued, selectAllHolders, type CardDesign } from '@/store/slices/holders-slice';
import { cn } from '@/utils/cn';
import { formatUsdc, shortNfiUid } from '@/utils/format';
import { cardIdFromNfiUid, cardId as generateCardId } from '@/utils/ids';

import { ProcessRail } from './-process-rail';

export function BankIssueFormScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const holders = useAppSelector(selectAllHolders);
  const { scanItemNfi, isNfiScanAvailable } = useScanItemNfi();
  const [name, setName] = useState('');
  const [cardId, setCardId] = useState(generateCardId);
  const [design, setDesign] = useState<CardDesign>('a');
  const [card, setCard] = useState<CardInfo>();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>();

  const issue = (nfiUid?: string) => {
    const { payload } = dispatch(
      cardIssued({ name: name.trim(), cardId: nfiUid ? cardIdFromNfiUid(nfiUid) : cardId, design, nfiUid }),
    );
    setName('');
    setCardId(generateCardId());
    setCard(undefined);
    navigation.navigate('BankTabStack', {
      screen: 'BankIssueStack',
      params: { screen: '(screens)/bank/issue/success', params: { holderId: payload.id } },
    });
  };

  const bind = async () => {
    setError(undefined);
    setIsScanning(true);

    try {
      const scanned = await scanItemNfi(`Hold the NFI near the device to bind it to ${name.trim()}`);
      if (!scanned) return;

      setCard(scanned);
      setCardId(cardIdFromNfiUid(scanned.uid));

      const owner = holders.find((holder) => holder.nfiUid === scanned.uid);
      if (owner) {
        setError(`This NFI is already bound to ${owner.name}.`);
        return;
      }

      issue(scanned.uid);
    } catch (scanError) {
      setError(scanError instanceof NfiScanError ? scanError.message : 'Could not read the card.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>PROVISIONING CEREMONY</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Issue secure card</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body contentContainerClassName="gap-4">
        <ProcessRail step={1} />
        <FormField
          label="CARDHOLDER NAME"
          value={name}
          onChangeText={setName}
          placeholder="Full legal name"
          autoCapitalize="words"
          returnKeyType="done"
        />
        <FormField label="CARD IDENTIFIER" value={cardId} onChangeText={setCardId} autoCapitalize="characters" />
        <CardDesignPicker label="CARD FACE" value={design} onChange={setDesign} />
        <PhysicalCard state="ACTIVE" design={design} holderName={name || 'Cardholder name'} />

        <View
          className={cn(
            'flex-row items-center gap-3 border p-3.75',
            card ? 'border-[#2f6249] bg-[#101d14]' : 'border-line bg-panel',
          )}
        >
          <Icon name="tap" size={30} />
          <View className="flex-1">
            <AppText className="text-sm">{card ? 'Secure element detected' : 'Tap the NFI to bind it'}</AppText>
            <AppText className="mt-1 text-2xs text-[#777]">
              {card
                ? `NFI ${shortNfiUid(card.uid)} · Firmware ${card.version}`
                : isScanning
                  ? 'Reading card…'
                  : 'The card is read when you bind & issue'}
            </AppText>
          </View>
          <StatusPill value={card ? (card.paired ? 'VERIFIED' : 'UNPAIRED') : 'WAITING'} className="self-center" />
        </View>
        {error && <AppText className="text-sm text-danger">{error}</AppText>}

        <InfoRows
          className="my-0"
          rows={[
            { label: 'DEFAULT LIMIT', value: `${formatUsdc(DEFAULT_DAILY_LIMIT)} USDC` },
            { label: 'NETWORK', value: NETWORK_NAME },
            { label: 'POLICY', value: 'VP-CARD-01' },
          ]}
        />
        {isNfiScanAvailable === false && __DEV__ ? (
          // No NFC reader (iOS simulator, emulators): issue without binding a physical card.
          <Button label="Issue card (simulated)" disabled={!name.trim()} onPress={() => issue()} />
        ) : (
          <Button
            label={isScanning ? 'Reading card…' : 'Bind & issue card'}
            disabled={!name.trim() || isScanning || !isNfiScanAvailable}
            onPress={bind}
          />
        )}
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
