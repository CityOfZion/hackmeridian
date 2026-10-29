import type { PinInput, PinProfile } from './card-auth';

/** Foreground-only memory; never serialized. A failed attempt must invalidate, never retry. */
export function createPinSession(now = Date.now) {
  let entry: (PinInput & { uid: string; expires: number }) | undefined;
  let generation = 0;
  return {
    generation: () => generation,
    clear() {
      entry = undefined;
      generation++;
    },
    remember(uid: string, input: PinInput, expectedGeneration = generation) {
      if (generation !== expectedGeneration || !input.password) return;
      entry = { uid, profile: { ...input.profile }, password: input.password, expires: now() + 15 * 60 * 1000 };
    },
    read(uid: string, profile?: PinProfile): PinInput | null {
      if (entry && now() >= entry.expires) entry = undefined;
      if (
        !entry ||
        entry.uid !== uid ||
        (profile &&
          (profile.identityId !== entry.profile.identityId ||
            profile.credentialIdentityId !== entry.profile.credentialIdentityId ||
            profile.credentialSlot !== entry.profile.credentialSlot))
      )
        return null;
      return { profile: { ...entry.profile }, password: entry.password };
    },
  };
}
export const cardPinSession = createPinSession();
