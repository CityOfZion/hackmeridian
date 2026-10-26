function hex(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16))
    .join('')
    .toUpperCase();
}

export function transactionId() {
  return `VP-${hex(4)}-${hex(4)}`;
}

export function cardId() {
  return `NFI3-${hex(4)}-${hex(4)}`;
}

/** Card identifier for a bound NFI, from the first 8 hex chars of its ITEM application UID */
export function cardIdFromNfiUid(uid: string) {
  const id = uid.toUpperCase();
  return `NFI3-${id.slice(0, 4)}-${id.slice(4, 8)}`;
}
