import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { KeyboardAvoidingView, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ResultBadge } from '@/components/ui/result-badge';
import { usePassTap } from '@/hooks/use-pass-tap';
import { useSignIn } from '@/hooks/use-sign-in';
import { SheetLayout } from '@/layouts/sheet-layout';

const PAIRING_KEY = /^[0-9a-fA-F]{64}$/;

/**
 * First tap of a Pass on this phone: asks for its application pairing key, then signs in with it. The key is saved
 * in SecureStore only after a verified signature; later taps on scan load it.
 */
export function PassPairingKeyDrawer() {
  const { t } = useTranslation(['drawers', 'common']);
  const navigation = useNavigation();
  const { tapPass, isTapping, error, setError } = usePassTap();
  const { signIn, isConfirming } = useSignIn(setError);
  const [pairingKey, setPairingKey] = useState('');
  const busy = isTapping || isConfirming;
  const isValid = PAIRING_KEY.test(pairingKey.replace(/\s+/g, ''));

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <SheetLayout
        badge={<ResultBadge icon="tap" tone="brass" round />}
        eyebrow={t('pass.pairingKey.eyebrow')}
        title={t('pass.pairingKey.title')}
        body={t('pass.pairingKey.body')}
      >
        <TextInput
          accessibilityLabel={t('pass.pairingKey.inputLabel')}
          value={pairingKey}
          onChangeText={setPairingKey}
          placeholder={t('pass.pairingKey.placeholder')}
          placeholderTextColor="#8a8a90"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          secureTextEntry
          className="min-h-12 rounded-xl border border-[#444] px-4 font-outfit text-paper focus:border-brass"
        />
        {error && <AppText className="text-center text-sm text-danger">{error}</AppText>}
        <Button
          icon="tap"
          label={
            isTapping
              ? t('common:tap.holdStill')
              : isConfirming
                ? t('common:tap.confirming')
                : t('common:tap.tapYourPass')
          }
          disabled={busy || !isValid}
          onPress={async () => signIn(await tapPass(t('pass.pairingKey.tapPrompt'), pairingKey))}
        />
        <Button
          variant="secondary"
          label={t('common:actions.cancel')}
          disabled={busy}
          onPress={() => navigation.goBack()}
        />
      </SheetLayout>
    </KeyboardAvoidingView>
  );
}
