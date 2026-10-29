let active = false;
/** Shared by signing and credential changes, including their PIN prompts. */
export function claimCardAction(): () => void {
  if (active) throw new Error('Another card action is in progress.');
  active = true;
  return () => {
    active = false;
  };
}

/** Journal immediately before the first state-changing command, after read-only preflight.
 * The returned proxy preserves the SDK's authenticated getters and bound channel state.
 */
export function journalCardMutations<
  T extends { tunnel: (ins: number, p1?: number, p2?: number, data?: Uint8Array) => Promise<Uint8Array> },
>(tunnel: T, before: () => Promise<void>): T {
  let recorded = false;
  return new Proxy(tunnel, {
    get(target, key) {
      if (key !== 'tunnel') return Reflect.get(target, key, target);
      return async (ins: number, p1?: number, p2?: number, data?: Uint8Array) => {
        const readOnly = [0x15, 0x81, 0x51, 0x14, 0x70].includes(ins) || (ins === 0x16 && !data?.length);
        if (!readOnly && !recorded) {
          await before();
          recorded = true;
        }
        return target.tunnel(ins, p1, p2, data);
      };
    },
  });
}

/** Invalid recovery records stay blocked until a successful fresh inspection. */
export function cardActionTimestamp(record: string): number {
  try {
    const parsed: unknown = JSON.parse(record);
    if (typeof parsed !== 'object' || parsed === null || !('at' in parsed) || typeof parsed.at !== 'string')
      return Infinity;
    const at = Date.parse(parsed.at);
    return Number.isFinite(at) ? at : Infinity;
  } catch {
    return Infinity;
  }
}
