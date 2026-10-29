import { CardError, type CardInfo, type CardTransport, type ItemSecureTunnel } from '@item-systems/item/mobile';

/** Public routing information supplied at card activation; never a PIN or key. */
export type PinProfile = { identityId: number; credentialIdentityId: number; credentialSlot: number };
export type PinChange = { oldSlot: number; newSlot?: number; stage: 'enrolling' | 'verify' | 'remove' | 'removing' };
export type CardCredential =
  | { mode: 'pairing'; pairingKey: string; publicKey: string }
  | { mode: 'pin'; profile: PinProfile; publicKey: string; change?: PinChange };
export type PinInput = { profile: PinProfile; password: string };

export function pinProfile(value: PinProfile): PinProfile {
  if (
    !value ||
    ![value.identityId, value.credentialIdentityId].every((n) => Number.isInteger(n) && n >= 1 && n <= 127) ||
    !Number.isInteger(value.credentialSlot) ||
    value.credentialSlot < 0 ||
    value.credentialSlot > 3
  )
    throw new Error('Use identity numbers 1–127 and credential slot 0–3 from card activation.');
  return {
    identityId: value.identityId,
    credentialIdentityId: value.credentialIdentityId,
    credentialSlot: value.credentialSlot,
  };
}

/** Explicit allow-list: a PIN input cannot accidentally become a stored credential. */
export function parseCardCredential(value: unknown): CardCredential {
  const c = value as Partial<CardCredential>;
  if (
    !c ||
    typeof c !== 'object' ||
    typeof c.publicKey !== 'string' ||
    !/^(?:[0-9a-f]{64}|[0-9a-f]{66}|[0-9a-f]{130})$/.test(c.publicKey)
  )
    throw new Error('Saved card identity is invalid.');
  if (c.mode === 'pin') {
    const profile = pinProfile(c.profile!);
    const change = c.change;
    if (
      change &&
      (!['enrolling', 'verify', 'remove', 'removing'].includes(change.stage) ||
        !Number.isInteger(change.oldSlot) ||
        change.oldSlot < 0 ||
        change.oldSlot > 3 ||
        (change.newSlot !== undefined &&
          (!Number.isInteger(change.newSlot) ||
            change.newSlot < 0 ||
            change.newSlot > 3 ||
            change.newSlot === change.oldSlot)) ||
        (change.stage !== 'enrolling' && change.newSlot === undefined))
    )
      throw new Error('Saved PIN change needs recovery.');
    return {
      mode: 'pin',
      publicKey: c.publicKey,
      profile,
      ...(change
        ? {
            change: {
              stage: change.stage,
              oldSlot: change.oldSlot,
              ...(change.newSlot === undefined ? {} : { newSlot: change.newSlot }),
            },
          }
        : {}),
    };
  }
  // Existing installations have no mode discriminator.
  const legacy = c as { mode?: string; pairingKey?: string; publicKey: string };
  if (
    (legacy.mode !== undefined && legacy.mode !== 'pairing') ||
    typeof legacy.pairingKey !== 'string' ||
    !/^[0-9a-f]{64}$/.test(legacy.pairingKey)
  )
    throw new Error('Saved pairing credential is invalid.');
  return { mode: 'pairing', pairingKey: legacy.pairingKey, publicKey: legacy.publicKey };
}

export function authenticationMode(
  info: CardInfo,
  saved: CardCredential | null,
  entered?: 'pin' | 'pairing',
  issuerBootstrap = false,
) {
  if (issuerBootstrap) {
    if (entered !== 'pairing' || !info.paired) throw new Error('Factory pairing is unavailable for this bank action.');
    return 'pairing' as const;
  }
  if (saved?.mode === 'pin' && entered === 'pairing')
    throw new Error('This card uses PIN authentication. A failed PIN cannot fall back to pairing.');
  if (entered === 'pin' || saved?.mode === 'pin') return 'pin' as const;
  if (entered === 'pairing' || saved?.mode === 'pairing') return 'pairing' as const;
  return info.initialization ? ('pin' as const) : ('pairing' as const);
}

/** Observes only public PAKE parameters and command headers. Never retains APDU payloads. */
export function pinAttemptTransport(transport: CardTransport) {
  const state = {
    began: false,
    confirmed: false,
    remaining: undefined as number | undefined,
    limit: undefined as number | undefined,
  };
  return {
    state,
    transport: {
      connect: () => transport.connect(),
      disconnect: () => transport.disconnect(),
      async transmit(command: Uint8Array) {
        const exchange = command[0] === 0xa0 && command[1] === 0x25;
        if (exchange && command[2] === 1) state.began = true;
        const reply = await transport.transmit(command);
        if (exchange && command[2] === 2 && reply.length === 34 && reply[32] === 0x90 && reply[33] === 0)
          state.confirmed = true;
        if (
          exchange &&
          command[2] === 0 &&
          reply.length === 21 &&
          reply[19] === 0x90 &&
          reply[20] === 0 &&
          reply[17] >= 1 &&
          reply[17] <= 10 &&
          reply[18] <= reply[17]
        ) {
          state.limit = reply[17];
          state.remaining = reply[18];
        }
        return reply;
      },
    } satisfies CardTransport,
  };
}

export function pinFailure(error: unknown, state: ReturnType<typeof pinAttemptTransport>['state']): string {
  if (state.remaining === 0 || (error instanceof CardError && error.status === 0x6983))
    return 'This PIN is blocked. Reconnecting or restarting will not reset it. Use your established recovery process; resetting the card can destroy its wallet keys.';
  if (error instanceof CardError && error.status === 0x6982 && state.began) {
    const remaining = state.remaining === undefined ? undefined : Math.max(0, state.remaining - 1);
    return `PIN authentication was rejected.${remaining === undefined ? '' : ` ${remaining} attempts remaining.`} No automatic retry was made.`;
  }
  if (state.began)
    return 'Card authentication did not finish. An attempt may have been used. Keep the card steady on your next deliberate tap; VaultPass will not retry automatically.';
  return 'PIN authentication could not start. Check the card access profile and supported firmware. No PIN attempt was sent.';
}

export async function openPin(
  tunnel: Pick<ItemSecureTunnel, 'openWithPassword'>,
  input: PinInput,
  state: ReturnType<typeof pinAttemptTransport>['state'],
) {
  const profile = pinProfile(input.profile);
  try {
    await tunnel.openWithPassword({ ...profile, password: input.password });
  } catch (error) {
    throw new Error(pinFailure(error, state));
  } finally {
    input.password = '';
  }
}

/** The supplied default PIN is six characters; personal PINs can be up to twelve. */
export const DEFAULT_PIN_LENGTH = 6;
export function validCardPin(password: string): boolean {
  const length = Array.from(password).length;
  return length >= DEFAULT_PIN_LENGTH && length <= 12 && !/[\u0000-\u001f\u007f]/.test(password);
}
