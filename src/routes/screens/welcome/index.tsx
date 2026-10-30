import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { ScreenLayout } from '@/layouts/screen-layout';
import { Choice, Muted } from '@/components/wallet/primitives';
import { cardPinSession } from '@/api/item/pin-session';

export function WelcomeScreen() {
  const navigation = useNavigation();
  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>VaultPass</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Welcome to VaultPass</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body contentContainerClassName="grow pb-safe-offset-8">
        <View className="gap-5">
          <Muted>How will you use VaultPass?</Muted>
          <Choice
            title="I'm a bank"
            detail="Configure and manage issued cards."
            onPress={() => {
              cardPinSession.clear();
              navigation.navigate('(screens)/bank');
            }}
          />
          <Choice
            title="I'm a user"
            detail="Tap your card to set it up or open your wallet."
            onPress={() => {
              cardPinSession.clear();
              navigation.navigate('(screens)/scan');
            }}
          />
          <Muted>You can switch roles at any time.</Muted>
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
