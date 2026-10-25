import type { StaticScreenProps } from '@react-navigation/native';
import { Alert, View } from 'react-native';

import { PhysicalCard } from '@/components/card/physical-card';
import { Button } from '@/components/ui/button';
import { InfoRows } from '@/components/ui/info-rows';
import { ScreenLayout } from '@/layouts/screen-layout';
import { SectionTitle } from '@/components/ui/section-title';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { cardStateChanged, selectHolderById, type CardState } from '@/store/slices/holders-slice';
import { formatUsdc, shortCardId } from '@/utils/format';

import type { TBankCardsDetailsScreenParams } from './types';

const notAvailable = () => Alert.alert('Not available', 'This action is not part of the demo yet.');

export function BankCardsDetailsScreen({ route }: StaticScreenProps<TBankCardsDetailsScreenParams>) {
  const dispatch = useAppDispatch();
  const holder = useAppSelector((state) => selectHolderById(state, route.params.holderId));
  const setState = (state: CardState) => dispatch(cardStateChanged({ id: holder.id, state }));

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{`CARDHOLDER · ${shortCardId(holder.cardId)}`}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{holder.name}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <PhysicalCard state={holder.state} design={holder.design} holderName={holder.name} />
        <InfoRows
          rows={[
            { label: 'CARD STATE', value: `STATE_${holder.state}` },
            { label: 'DAILY LIMIT', value: `${formatUsdc(holder.dailyLimit)} USDC` },
            { label: 'BOUND ACCOUNT', value: holder.account },
          ]}
        />
        <SectionTitle title="Administrative actions" />
        <View className="gap-2.25">
          <View className="flex-row gap-2.25">
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
          <View className="flex-row gap-2.25">
            <Button className="flex-1" variant="danger" label="Terminate" onPress={notAvailable} />
            <Button className="flex-1" variant="secondary" label="Reissue" onPress={notAvailable} />
          </View>
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
