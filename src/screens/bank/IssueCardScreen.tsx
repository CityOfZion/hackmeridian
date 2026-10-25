import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';

import { CardDesignPicker } from '../../components/card/CardDesignPicker';
import { PhysicalCard } from '../../components/card/PhysicalCard';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Icon } from '../../components/ui/Icon';
import { InfoRows } from '../../components/ui/InfoRows';
import { Screen } from '../../components/ui/Screen';
import { StatusPill } from '../../components/ui/StatusPill';
import { DEFAULT_DAILY_LIMIT, FIRMWARE_VERSION, NETWORK_NAME } from '../../constants';
import { useAppDispatch } from '../../store/hooks';
import { cardIssued, type CardDesign } from '../../store/slices/holdersSlice';
import { cn } from '../../utils/cn';
import { formatUsdc } from '../../utils/format';
import { cardId as generateCardId } from '../../utils/ids';

function ProcessRail({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View className="mb-3.5 mt-1 flex-row items-center justify-center">
      {[1, 2, 3].map((n) => (
        <View key={n} className="flex-row items-center">
          {n > 1 && <View className="h-px w-10 bg-[#333]" />}
          <View className={cn('size-[26px] items-center justify-center border border-[#333]', n === step && 'border-brass bg-brass')}>
            <AppText className={cn('text-[9px] text-[#666]', n === step && 'text-[#111]')}>{n}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

export function IssueCardScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [cardId, setCardId] = useState(generateCardId);
  const [design, setDesign] = useState<CardDesign>('a');

  const issue = () => {
    const { payload } = dispatch(cardIssued({ name: name.trim(), cardId, design }));
    setName('');
    setCardId(generateCardId());
    navigation.navigate('Bank', { screen: 'Issue', params: { screen: 'IssueSuccess', params: { holderId: payload.id } } });
  };

  return (
    <Screen eyebrow="PROVISIONING CEREMONY" title="Issue secure card" contentClassName="gap-4">
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

      <View className="flex-row items-center gap-3 border border-[#2f6249] bg-[#101d14] p-[15px]">
        <Icon name="tap" size={30} />
        <View className="flex-1">
          <AppText className="text-[13px]">Secure element detected</AppText>
          <AppText className="mt-1 text-[10px] text-[#777]">Attestation valid · Firmware {FIRMWARE_VERSION}</AppText>
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
    </Screen>
  );
}
