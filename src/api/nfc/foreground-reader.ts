/** A process-owned Android registration: closing an exchange must not release NDEF suppression.
 * The native manager disables reader mode on Activity pause and restores it on resume.
 * No APDUs or authentication are performed by the idle reader.
 */
export function foregroundReader(io: {
  register: () => Promise<void>;
  connectPresent: () => Promise<void>;
  waitForCard: () => Promise<unknown>;
}) {
  let registration: Promise<void> | undefined;
  const ensure = () => {
    registration ??= io.register().catch((error) => {
      registration = undefined;
      throw error;
    });
    return registration;
  };
  return {
    ensure,
    async connect(cancelled: () => boolean) {
      await ensure();
      if (cancelled()) throw new Error('Card operation cancelled');
      // Reuse a card already discovered while the PIN dialog was open. A stale tag is
      // only a transport failure; waiting for a fresh tap does not send or retry a PIN.
      try {
        await io.connectPresent();
      } catch (error) {
        if (cancelled()) throw error;
        await io.waitForCard();
      }
      if (cancelled()) throw new Error('Card operation cancelled');
    },
  };
}
