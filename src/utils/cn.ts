import { extendTailwindMerge } from 'tailwind-merge';

// Uniwind safe-area values: `pt-safe`, `pb-safe-or-4`, `pt-safe-offset-3`, ...
const isSafeArea = (value: string) => /^safe(-(or|offset)-[\d.]+)?$/.test(value);

const SPACING_GROUPS = ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml'] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: Object.fromEntries(SPACING_GROUPS.map((group) => [group, [{ [group]: [isSafeArea] }]])),
  },
});

export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(' '));
}
