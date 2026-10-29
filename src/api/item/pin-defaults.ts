import type { PinProfile } from './card-auth';

export type PinDefaultsRequest = {
  profile?: PinProfile;
  newPin?: boolean;
  defaults?: 'issuer' | 'initial-holder' | 'personal';
};

/** Public provisioning defaults only. Never prefill a saved cardholder's personal PIN. */
export function pinPromptDefaults(request: PinDefaultsRequest) {
  const role = request.defaults ?? (!request.profile ? 'initial-holder' : undefined);
  return {
    profile: request.profile ?? {
      identityId: role === 'issuer' ? 1 : 2,
      credentialIdentityId: role === 'issuer' ? 1 : 2,
      credentialSlot: 0,
    },
    password: !request.newPin && (role === 'issuer' || role === 'initial-holder') ? '000000' : '',
  };
}
