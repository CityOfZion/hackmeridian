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
