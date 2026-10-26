import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CardDesign } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { cn } from '@/utils/cn';

import { CARD_DESIGNS, PhysicalCard } from './physical-card';

type Props = {
  label: string;
  value: CardDesign;
  onChange: (design: CardDesign) => void;
  className?: string;
};

export function CardDesignPicker({ label, value, onChange, className }: Props) {
  const { t } = useTranslation();
  return (
    <View className={className}>
      <AppText className="mb-2.25 text-3xs tracking-widest text-[#888]">{label}</AppText>
      <View className="flex-row gap-1.5">
        {CARD_DESIGNS.map((design) => (
          <Pressable
            key={design}
            accessibilityRole="button"
            accessibilityState={{ selected: value === design }}
            accessibilityLabel={t('card.a11yFace', { design: design.toUpperCase() })}
            onPress={() => onChange(design)}
            className={cn('flex-1 border p-0.5', value === design ? 'border-brass' : 'border-[#2d2d30]')}
          >
            <PhysicalCard design={design} compact />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
