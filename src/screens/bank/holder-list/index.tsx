import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { HolderRow } from '../../../components/rows/holder-row';
import { AppText } from '../../../components/ui/app-text';
import { Icon } from '../../../components/ui/icon';
import { ScreenLayout } from '../../../components/layout/screen-layout';
import { useAppSelector } from '../../../store/hooks';
import { selectAllHolders } from '../../../store/slices/holders-slice';

export function HolderListScreen() {
  const navigation = useNavigation();
  const holders = useAppSelector(selectAllHolders);
  const [query, setQuery] = useState('');

  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? holders.filter((h) => h.name.toLowerCase().includes(normalized) || h.cardId.toLowerCase().includes(normalized))
    : holders;

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>BANK OWNER</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Cardholders</ScreenLayout.Title>
        </ScreenLayout.Heading>
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="mb-4.5 h-11.5 flex-row items-center gap-2 border-b border-[#666]">
          <Icon name="search" size={18} color="#777" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name or card ID"
            placeholderTextColorClassName="accent-[#777]"
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 py-2.5 font-outfit text-base text-[#eee]"
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
          {visible.length === 0 && (
            <AppText className="py-6 text-center text-sm text-muted">No cardholders match “{query}”.</AppText>
          )}
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
