import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { HolderRow } from '../../components/rows/HolderRow';
import { AppText } from '../../components/ui/AppText';
import { Icon } from '../../components/ui/Icon';
import { Screen } from '../../components/ui/Screen';
import { useAppSelector } from '../../store/hooks';
import { selectAllHolders } from '../../store/slices/holdersSlice';

export function HolderListScreen() {
  const navigation = useNavigation();
  const holders = useAppSelector(selectAllHolders);
  const [query, setQuery] = useState('');

  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? holders.filter((h) => h.name.toLowerCase().includes(normalized) || h.cardId.toLowerCase().includes(normalized))
    : holders;

  return (
    <Screen eyebrow="BANK OWNER" title="Cardholders">
      <View className="mb-[18px] h-[46px] flex-row items-center gap-2 border-b border-[#666]">
        <Icon name="search" size={18} color="#777" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name or card ID"
          placeholderTextColorClassName="accent-[#777]"
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 py-2.5 font-outfit text-[16px] text-[#eee]"
        />
      </View>
      <View className="border-t border-[#444]">
        {visible.map((holder) => (
          <HolderRow
            key={holder.id}
            holder={holder}
            onPress={() =>
              navigation.navigate('Bank', {
                screen: 'Cards',
                params: { screen: 'HolderDetail', params: { holderId: holder.id } },
              })
            }
          />
        ))}
        {visible.length === 0 && <AppText className="py-6 text-center text-[13px] text-muted">No cardholders match “{query}”.</AppText>}
      </View>
    </Screen>
  );
}
