import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { View } from 'react-native';

import { PhysicalCard } from '@/components/card/physical-card';
import { AppText, Eyebrow } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { InfoRows } from '@/components/ui/info-rows';
import { ResultBadge } from '@/components/ui/result-badge';
import { ScreenLayout } from '@/layouts/screen-layout';
import { useAppSelector } from '@/store/hooks';
import { selectHolderById } from '@/store/slices/holders-slice';

import type { TBankIssueSuccessScreenParams } from './types';

export function BankIssueSuccessScreen({ route }: StaticScreenProps<TBankIssueSuccessScreenParams>) {
  const navigation = useNavigation();
  const holder = useAppSelector((state) => selectHolderById(state, route.params.holderId));

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>PROVISIONING CEREMONY</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Issue secure card</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="items-center pt-8">
          <ResultBadge icon="check" tone="success" />
          <Eyebrow>PROVISIONING COMPLETE</Eyebrow>
          <AppText className="my-2.5 font-outfit-semibold text-4xl tracking-tight">Card issued</AppText>
          <AppText className="mb-5 text-sm text-muted">Ready for pickup by {holder.name}.</AppText>
        </View>
        <PhysicalCard state={holder.state} design={holder.design} holderName={holder.name} />
        <InfoRows
          rows={[
            { label: 'CARD ID', value: holder.cardId },
            { label: 'STATE', value: 'STATE_SECURED' },
          ]}
        />
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button
          label="View cardholder"
          onPress={() =>
            navigation.navigate('BankTabStack', {
              screen: 'BankCardsStack',
              params: { screen: '(screens)/bank/cards/details', params: { holderId: holder.id } },
            })
          }
        />
        <Button
          variant="secondary"
          label="Issue another"
          onPress={() => navigation.dispatch(StackActions.popToTop())}
        />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
