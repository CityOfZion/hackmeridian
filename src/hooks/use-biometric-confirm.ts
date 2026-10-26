import { authenticateAsync, hasHardwareAsync, isEnrolledAsync } from 'expo-local-authentication';

import i18n from '@/i18n';

export class BiometricError extends Error {}

/**
 * Face ID / fingerprint check, the second factor next to the Pass tap (the spec's passkey step). Resolves `false`
 * when the user cancels. Simulators and emulators without biometrics skip the check in development builds.
 */
async function confirmWithBiometrics(promptMessage: string): Promise<boolean> {
  const available = (await hasHardwareAsync()) && (await isEnrolledAsync());
  if (!available) {
    if (__DEV__) return true;
    throw new BiometricError(i18n.t('common:errors.biometrics.notSetUp'));
  }

  const result = await authenticateAsync({ promptMessage, cancelLabel: i18n.t('common:biometrics.cancel') });
  if (result.success) return true;
  if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') return false;
  if (result.error === 'lockout') throw new BiometricError(i18n.t('common:errors.biometrics.lockout'));
  throw new BiometricError(i18n.t('common:errors.biometrics.failed'));
}

export function useBiometricConfirm() {
  return { confirmWithBiometrics };
}
