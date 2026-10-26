const DAY_MS = 24 * 60 * 60 * 1000;

export function isSameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function formatClock(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatTransactionTime(timestamp: number, now = Date.now()) {
  if (now - timestamp < 60_000) return 'Just now';
  if (isSameDay(timestamp, now)) return `Today · ${formatClock(timestamp)}`;
  if (isSameDay(timestamp, now - DAY_MS)) return `Yesterday · ${formatClock(timestamp)}`;
  return new Date(timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' });
}

/** Compact age for activity feeds: "now", "5m", "2h", "3d". */
export function formatAge(timestamp: number, now = Date.now()) {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function formatUsdc(amount: number) {
  return amount.toFixed(2);
}

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** "NFI3-09F2-4A81" → "NFI · 09F2" */
export function shortCardId(cardId: string) {
  return `NFI · ${cardId.split('-')[1] ?? cardId}`;
}

/** 32-hex-char ITEM application UID → `A1B2C3…E5F6` */
export function shortNfiUid(uid: string) {
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`.toUpperCase();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
