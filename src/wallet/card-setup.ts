/** View state only: card operations still enforce ownership, activation and recovery receipts. */
export function cardSetupStep(state: {
  identified: boolean;
  activationLoaded: boolean;
  activationComplete: boolean;
  activationPending: boolean;
  existingPersonalPin: boolean;
  masterReviewed: boolean;
}): 1 | 2 | 3 | 4 {
  if (!state.identified) return 1;
  if (!state.activationLoaded || state.activationPending || (!state.activationComplete && !state.existingPersonalPin))
    return 2;
  return state.masterReviewed ? 4 : 3;
}

export function selectedCardRing(
  rings: { ring: number; master: number; publicKey: string }[] | undefined,
  master: string,
  ring: string,
) {
  if (!master || !ring) return undefined;
  return rings?.find((r) => String(r.master) === master && String(r.ring) === ring);
}
