import i18n from '@/i18n';

export function formatAmount(amount: number) {
  return amount.toFixed(2);
}

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return i18n.t('common:greeting.morning');
  if (hour < 18) return i18n.t('common:greeting.afternoon');
  return i18n.t('common:greeting.evening');
}

/** 32-hex-char ITEM application UID → `A1B2C3…E5F6` */
export function shortNfiUid(uid: string) {
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`.toUpperCase();
}
