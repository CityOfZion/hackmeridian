import { useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';

import { PhysicalCard } from '@/components/card/physical-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { InfoRows } from '@/components/ui/info-rows';
import { NETWORK_NAME, WITHDRAW_DELAY_MS } from '@/constants';
import { BiometricError, useBiometricConfirm } from '@/hooks/use-biometric-confirm';
import { ScreenLayout } from '@/layouts/screen-layout';
import { apiErrorMessage, usePasskeyRegisterMutation } from '@/store/api/vault-api';
import { useAppDispatch } from '@/store/hooks';
import { sessionStarted } from '@/store/slices/session-slice';
import { shortNfiUid } from '@/utils/format';

import type { TRegisterScreenParams } from './types';

/** First tap of an unknown Pass: name it, enroll Face ID and deploy the user's Spend Vault. */
export function RegisterScreen({ route }: StaticScreenProps<TRegisterScreenParams>) {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { chipId, tapToken } = route.params;
  const { confirmWithBiometrics } = useBiometricConfirm();
  const [passkeyRegister, { isLoading }] = usePasskeyRegisterMutation();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const trimmedName = name.trim();

  const register = async () => {
    setError(undefined);
    try {
      if (!(await confirmWithBiometrics('Bind Face ID to your Pass'))) return;
      const session = await passkeyRegister({ tapToken, chipId, name: trimmedName }).unwrap();
      dispatch(sessionStarted(session));
      navigation.reset({ index: 0, routes: [{ name: '(screens)/vault/dashboard' }] });
    } catch (registerError) {
      setError(registerError instanceof BiometricError ? registerError.message : apiErrorMessage(registerError));
    }
  };

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>NEW PASS</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Register your Pass</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body keyboardShouldPersistTaps="handled">
        <PhysicalCard state="ACTIVE" holderName={trimmedName || undefined} />
        <InfoRows
          rows={[
            { label: 'CHIP ID', value: shortNfiUid(chipId) },
            { label: 'NETWORK', value: NETWORK_NAME },
            { label: 'WITHDRAW DELAY', value: `${WITHDRAW_DELAY_MS / 60_000} MIN` },
          ]}
        />
        <FormField
          label="YOUR NAME"
          value={name}
          onChangeText={setName}
          placeholder="Maya Chen"
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="done"
        />
        <AppText className="mt-4 text-xs leading-normal text-muted">
          Face ID becomes your second factor: every sign-in, reload and withdrawal needs this Pass and your face.
        </AppText>
        {error && <AppText className="mt-4 text-sm text-danger">{error}</AppText>}
        {/* CTA stays in the body: the keyboard would cover a pinned footer */}
        <View className="mt-6">
          <Button
            label={isLoading ? 'Creating your vault…' : 'Enable Face ID and create vault'}
            disabled={!trimmedName || isLoading}
            onPress={register}
          />
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
