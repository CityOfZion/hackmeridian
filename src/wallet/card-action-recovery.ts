export function reviewInterruptedAccount(
  raw: string,
  keys: { masters: { slot: number; rings: number[] }[]; rings: { ring: number; master: number; publicKey: string }[] },
) {
  const r = JSON.parse(raw);
  if (
    r.action !== 'Create account' ||
    !/^\d+$/.test(r.master) ||
    !Array.isArray(r.existingRings) ||
    !r.existingRings.every((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 127)
  )
    throw new Error('This action needs its original recovery workflow.');
  const master = keys.masters.find((m) => m.slot === Number(r.master));
  if (!master) throw new Error('The original masterkey is not available to this identity.');
  // Older APKs only recorded exported account keyrings. They can still recover one
  // newly found account, but cannot prove an unchanged full master inventory.
  if (r.existingMasterRings === undefined) {
    if (r.existingRings.some((id: number) => !keys.rings.some((k) => k.ring === id)))
      throw new Error('An existing account is missing. Keep this receipt for inspection.');
    const added = keys.rings.filter((k) => k.master === master.slot && !r.existingRings.includes(k.ring));
    if (added.length !== 1)
      throw new Error(
        'This older receipt cannot uniquely identify a new account. Compare the card inventory with the saved receipt before clearing it.',
      );
    return {
      master: master.slot,
      ring: added[0],
      name: typeof r.name === 'string' ? r.name.slice(0, 40) : 'Recovered account',
    };
  }
  if (
    !Array.isArray(r.existingMasterRings) ||
    !r.existingMasterRings.every((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 127)
  )
    throw new Error('Invalid saved master inventory. Keep this receipt for inspection.');
  if (r.existingMasterRings.some((id: number) => !master.rings.includes(id)))
    throw new Error('An existing keyring is missing. Inspect this card before continuing.');
  const added = master.rings.filter((id) => !r.existingMasterRings.includes(id));
  if (added.length > 1)
    throw new Error('Multiple new keyrings were found. Select the intended account after manual review.');
  const ring = added.length ? keys.rings.find((k) => k.ring === added[0] && k.master === master.slot) : undefined;
  if (added.length && !ring)
    throw new Error('The new keyring could not be read as a supported account. Keep this receipt for inspection.');
  return { master: master.slot, ring, name: typeof r.name === 'string' ? r.name.slice(0, 40) : 'Recovered account' };
}
