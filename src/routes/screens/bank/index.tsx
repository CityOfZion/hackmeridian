import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { ScreenLayout } from '@/layouts/screen-layout';
import { Choice, Muted } from '@/components/wallet/primitives';
import { cardPinSession } from '@/api/item/pin-session';
import { Button } from '@/components/ui/button';

export function BankScreen() {
  const navigation = useNavigation();
  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>VaultPass · Bank</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Bank workspace</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="gap-5">
          <Muted>Choose what you want to do with a card.</Muted>
          <Choice
            title="Configure Card"
            detail="Create the cardholder identity, issue a masterkey and prepare the handoff."
            onPress={() => navigation.navigate('(screens)/bank/configure')}
          />
          <Choice
            title="Edit Card"
            detail="Update the verification link, review issuance and recover interrupted bank actions."
            onPress={() => navigation.navigate('(screens)/bank/edit')}
          />
          <Button
            label="Switch role"
            variant="secondary"
            onPress={() => {
              cardPinSession.clear();
              navigation.reset({ index: 0, routes: [{ name: '(screens)/welcome' }] });
            }}
          />
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
