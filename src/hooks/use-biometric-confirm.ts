import { authenticateAsync, hasHardwareAsync, isEnrolledAsync } from 'expo-local-authentication';

export class BiometricError extends Error {}

/**
 * Face ID / fingerprint check, the second factor next to the Pass tap (the spec's passkey step). Resolves `false`
 * when the user cancels. Simulators and emulators without biometrics skip the check in development builds.
 */
async function confirmWithBiometrics(promptMessage: string): Promise<boolean> {
  const available = (await hasHardwareAsync()) && (await isEnrolledAsync());
  if (!available) {
    if (__DEV__) return true;
    throw new BiometricError('Set up Face ID or a fingerprint on this device to use your Pass.');
  }

  const result = await authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
  if (result.success) return true;
  if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') return false;
  if (result.error === 'lockout') throw new BiometricError('Biometrics are locked. Unlock your device and try again.');
  throw new BiometricError('Biometric check failed. Try again.');
}

export function useBiometricConfirm() {
  return { confirmWithBiometrics };
}
