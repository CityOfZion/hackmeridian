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

export function formatAmount(amount: number) {
  return amount.toFixed(2);
}

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Stellar strkey → `GCT4…9QP7` */
export function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** 32-hex-char ITEM application UID → `A1B2C3…E5F6` */
export function shortNfiUid(uid: string) {
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`.toUpperCase();
}

/** Time left until `timestamp` as `m:ss`, never negative. */
export function formatCountdown(timestamp: number, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((timestamp - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
