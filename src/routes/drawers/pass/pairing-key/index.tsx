import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { KeyboardAvoidingView, TextInput } from 'react-native';

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
        eyebrow="FIRST TAP"
        title="Pair your Pass"
        body="Enter this Pass’s 64-character application pairing key. VaultPass saves it securely on this phone after a verified signature."
      >
        <TextInput
          accessibilityLabel="ITEM application pairing key"
          value={pairingKey}
          onChangeText={setPairingKey}
          placeholder="Application pairing key"
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
          label={isTapping ? 'Hold your Pass still…' : isConfirming ? 'Confirming…' : 'Tap your Pass'}
          disabled={busy || !isValid}
          onPress={async () => signIn(await tapPass('Hold your Pass near the phone to pair it', pairingKey))}
        />
        <Button variant="secondary" label="Cancel" disabled={busy} onPress={() => navigation.goBack()} />
      </SheetLayout>
    </KeyboardAvoidingView>
  );
}
