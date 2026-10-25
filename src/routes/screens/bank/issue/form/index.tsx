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
import { DEFAULT_DAILY_LIMIT, FIRMWARE_VERSION, NETWORK_NAME } from '@/constants';
import { useAppDispatch } from '@/store/hooks';
import { cardIssued, type CardDesign } from '@/store/slices/holders-slice';
import { formatUsdc } from '@/utils/format';
import { cardId as generateCardId } from '@/utils/ids';

import { ProcessRail } from './-process-rail';

export function BankIssueFormScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [cardId, setCardId] = useState(generateCardId);
  const [design, setDesign] = useState<CardDesign>('a');

  const issue = () => {
    const { payload } = dispatch(cardIssued({ name: name.trim(), cardId, design }));
    setName('');
    setCardId(generateCardId());
    navigation.navigate('BankTabStack', {
      screen: 'BankIssueStack',
      params: { screen: '(screens)/bank/issue/success', params: { holderId: payload.id } },
    });
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

        <View className="flex-row items-center gap-3 border border-[#2f6249] bg-[#101d14] p-3.75">
          <Icon name="tap" size={30} />
          <View className="flex-1">
            <AppText className="text-sm">Secure element detected</AppText>
            <AppText className="mt-1 text-2xs text-[#777]">Attestation valid · Firmware {FIRMWARE_VERSION}</AppText>
          </View>
          <StatusPill value="VERIFIED" className="self-center" />
        </View>

        <InfoRows
          className="my-0"
          rows={[
            { label: 'DEFAULT LIMIT', value: `${formatUsdc(DEFAULT_DAILY_LIMIT)} USDC` },
            { label: 'NETWORK', value: NETWORK_NAME },
            { label: 'POLICY', value: 'VP-CARD-01' },
          ]}
        />
        <Button label="Bind & issue card" disabled={!name.trim()} onPress={issue} />
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
