import { useNavigation } from '@react-navigation/native';
import { Pressable, Text, View } from 'react-native';

import { useAppDispatch, useAppSelector } from '../store/hooks';
import { decrement, increment, reset, selectCount } from '../store/slices/counterSlice';

export function HomeScreen() {
  const navigation = useNavigation();
  const count = useAppSelector(selectCount);
  const dispatch = useAppDispatch();

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-white p-6 dark:bg-neutral-950">
      <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
        Count: {count}
      </Text>

      <View className="flex-row gap-3">
        <Pressable
          className="rounded-lg bg-neutral-200 px-5 py-3 active:opacity-70 dark:bg-neutral-800"
          onPress={() => dispatch(decrement())}
        >
          <Text className="text-lg text-neutral-900 dark:text-white">−</Text>
        </Pressable>
        <Pressable
          className="rounded-lg bg-neutral-200 px-5 py-3 active:opacity-70 dark:bg-neutral-800"
          onPress={() => dispatch(reset())}
        >
          <Text className="text-lg text-neutral-900 dark:text-white">Reset</Text>
        </Pressable>
        <Pressable
          className="rounded-lg bg-neutral-200 px-5 py-3 active:opacity-70 dark:bg-neutral-800"
          onPress={() => dispatch(increment())}
        >
          <Text className="text-lg text-neutral-900 dark:text-white">+</Text>
        </Pressable>
      </View>

      <Pressable
        className="rounded-lg bg-blue-600 px-6 py-3 active:opacity-70"
        onPress={() => navigation.navigate('Details', { id: String(count) })}
      >
        <Text className="font-semibold text-white">Open details</Text>
      </Pressable>
    </View>
  );
}
