import type { StaticScreenProps } from '@react-navigation/native';
import { Text, View } from 'react-native';

type Props = StaticScreenProps<{
  id: string;
}>;

export function DetailsScreen({ route }: Props) {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
      <Text className="text-xl text-neutral-900 dark:text-white">
        Details for #{route.params.id}
      </Text>
    </View>
  );
}
