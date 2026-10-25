import { StackActions, useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { View } from 'react-native';

import { PhysicalCard } from '../../components/card/PhysicalCard';
import { AppText, Eyebrow } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { InfoRows } from '../../components/ui/InfoRows';
import { ResultBadge } from '../../components/ui/ResultBadge';
import { Screen } from '../../components/ui/Screen';
import { useAppSelector } from '../../store/hooks';
import { selectHolderById } from '../../store/slices/holdersSlice';

type Props = StaticScreenProps<{ holderId: string }>;

export function IssueSuccessScreen({ route }: Props) {
  const navigation = useNavigation();
  const holder = useAppSelector((state) => selectHolderById(state, route.params.holderId));

  return (
    <Screen eyebrow="PROVISIONING CEREMONY" title="Issue secure card">
      <View className="items-center pt-8">
        <ResultBadge icon="check" tone="success" />
        <Eyebrow>PROVISIONING COMPLETE</Eyebrow>
        <AppText className="my-2.5 font-outfit-semibold text-[34px] tracking-[-1px]">Card issued</AppText>
        <AppText className="mb-5 text-[13px] text-muted">Ready for pickup by {holder.name}.</AppText>
      </View>
      <PhysicalCard state={holder.state} design={holder.design} holderName={holder.name} />
      <InfoRows
        rows={[
          { label: 'CARD ID', value: holder.cardId },
          { label: 'STATE', value: 'STATE_SECURED' },
        ]}
      />
      <View className="gap-2.5">
        <Button
          label="View cardholder"
          onPress={() =>
            navigation.navigate('Bank', {
              screen: 'Cards',
              params: { screen: 'HolderDetail', params: { holderId: holder.id } },
            })
          }
        />
        <Button variant="secondary" label="Issue another" onPress={() => navigation.dispatch(StackActions.popToTop())} />
      </View>
    </Screen>
  );
}
