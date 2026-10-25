import type { StaticScreenProps } from '@react-navigation/native';
import { Alert, View } from 'react-native';

import { PhysicalCard } from '../../components/card/PhysicalCard';
import { Button } from '../../components/ui/Button';
import { InfoRows } from '../../components/ui/InfoRows';
import { Screen } from '../../components/ui/Screen';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { cardStateChanged, selectHolderById, type CardState } from '../../store/slices/holdersSlice';
import { formatUsdc, shortCardId } from '../../utils/format';

type Props = StaticScreenProps<{ holderId: string }>;

const notAvailable = () => Alert.alert('Not available', 'This action is not part of the demo yet.');

export function HolderDetailScreen({ route }: Props) {
  const dispatch = useAppDispatch();
  const holder = useAppSelector((state) => selectHolderById(state, route.params.holderId));
  const setState = (state: CardState) => dispatch(cardStateChanged({ id: holder.id, state }));

  return (
    <Screen eyebrow={`CARDHOLDER · ${shortCardId(holder.cardId)}`} title={holder.name} canGoBack>
      <PhysicalCard state={holder.state} design={holder.design} holderName={holder.name} />
      <InfoRows
        rows={[
          { label: 'CARD STATE', value: `STATE_${holder.state}` },
          { label: 'DAILY LIMIT', value: `${formatUsdc(holder.dailyLimit)} USDC` },
          { label: 'BOUND ACCOUNT', value: holder.account },
        ]}
      />
      <SectionTitle title="Administrative actions" />
      <View className="gap-[9px]">
        <View className="flex-row gap-[9px]">
          <Button
            className="flex-1"
            variant="secondary"
            icon="lock"
            label={holder.state === 'SUSPENDED' ? 'Restore card' : 'Suspend card'}
            onPress={() => setState(holder.state === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED')}
          />
          <Button
            className="flex-1"
            variant="secondary"
            icon="card"
            label={holder.state === 'LOCKED' ? 'Unfreeze card' : 'Freeze card'}
            onPress={() => setState(holder.state === 'LOCKED' ? 'ACTIVE' : 'LOCKED')}
          />
        </View>
        <View className="flex-row gap-[9px]">
          <Button className="flex-1" variant="danger" label="Terminate" onPress={notAvailable} />
          <Button className="flex-1" variant="secondary" label="Reissue" onPress={notAvailable} />
        </View>
      </View>
    </Screen>
  );
}
