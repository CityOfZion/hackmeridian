import { authenticateAsync, getEnrolledLevelAsync, SecurityLevel } from 'expo-local-authentication';

export async function authenticateDevice(promptMessage: string) {
  if ((await getEnrolledLevelAsync()) === SecurityLevel.NONE)
    throw new Error('Set a device passcode or enroll biometrics in your phone settings first.');
  const result = await authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    biometricsSecurityLevel: 'strong',
  });
  if (!result.success) throw new Error('Device authentication was not completed.');
}
