import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Keyboard, KeyboardAvoidingView, Modal, ScrollView, View } from 'react-native';
import { pinProfile, validCardPin, type PinInput } from '@/api/item/card-auth';
import { pinPromptDefaults, type PinDefaultsRequest } from '@/api/item/pin-defaults';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';

type Request = { title: string; uid: string; description?: string; editProfile?: boolean } & PinDefaultsRequest;
type Ask = (request: Request) => Promise<PinInput | null>;
const Context = createContext<Ask | null>(null);
export function useCardPin() {
  const ask = useContext(Context);
  if (!ask) throw new Error('Card PIN provider is unavailable');
  return ask;
}

/** PINs exist only in this mounted input and the pending operation, never Redux/navigation/storage. */
export function CardPinProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [identity, setIdentity] = useState('');
  const [member, setMember] = useState('');
  const [slot, setSlot] = useState('0');
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef<((value: PinInput | null) => void) | undefined>(undefined);
  const finish = useCallback((value: PinInput | null) => {
    const resolve = pending.current;
    pending.current = undefined;
    setPassword('');
    setConfirm('');
    setRequest(undefined);
    setError(undefined);
    Keyboard.dismiss();
    resolve?.(value);
  }, []);
  const ask = useCallback<Ask>((next) => {
    if (pending.current) return Promise.reject(new Error('Another card approval is already open.'));
    const defaults = pinPromptDefaults(next);
    setPassword(defaults.password);
    setConfirm('');
    setError(undefined);
    setIdentity(String(defaults.profile.identityId));
    setMember(String(defaults.profile.credentialIdentityId));
    setSlot(String(defaults.profile.credentialSlot));
    setAdvanced(next.defaults === 'issuer' && !next.profile);
    setRequest(next);
    return new Promise((resolve) => {
      pending.current = resolve;
    });
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') finish(null);
    });
    return () => {
      sub.remove();
      pending.current?.(null);
      pending.current = undefined;
    };
  }, [finish]);
  const valid = validCardPin(password) && (!request?.newPin || password === confirm);
  return (
    <Context.Provider value={ask}>
      {children}
      <Modal visible={!!request} transparent animationType="none" onRequestClose={() => finish(null)}>
        <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end bg-black/85">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="grow justify-end p-5 pb-safe-offset-5"
          >
            <View className="gap-4 rounded-3xl border border-brass bg-panel p-6">
              <AppText className="font-outfit-semibold text-2xl">{request?.title}</AppText>
              <AppText className="text-sm text-muted">
                Card {request?.uid.slice(0, 6)}…{request?.uid.slice(-4)} ·{' '}
                {request?.description ??
                  (request?.newPin
                    ? 'Choose 6–12 characters. Your signing key and account stay the same.'
                    : pinPromptDefaults(request ?? {}).password
                      ? 'Initial PIN 000000 is filled in. Change it here if your PIN is different, then continue to tap.'
                      : 'Enter your card PIN, then hold the card to your phone. Your PIN is never saved.')}
              </AppText>
              <FormField
                label={request?.newPin ? 'New card PIN' : 'Card PIN'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                autoCorrect={false}
                maxLength={12}
              />
              {request?.newPin && (
                <FormField
                  label="Confirm new PIN"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="off"
                  textContentType="none"
                  importantForAutofill="no"
                  autoCorrect={false}
                  maxLength={12}
                />
              )}
              {(!request?.profile || request.editProfile) && (
                <>
                  <Button
                    variant="secondary"
                    label={
                      request?.defaults === 'issuer'
                        ? advanced
                          ? 'Hide card access profile'
                          : 'Card access profile'
                        : advanced
                          ? 'Hide technical details'
                          : 'Card access details'
                    }
                    onPress={() => setAdvanced(!advanced)}
                  />
                  {advanced && (
                    <>
                      <AppText className="text-sm text-muted">
                        Use the public access profile supplied with your card. These identity numbers are saved after
                        successful verification; your PIN is never saved.
                      </AppText>
                      <FormField
                        label="Signing identity / group"
                        value={identity}
                        onChangeText={setIdentity}
                        keyboardType="number-pad"
                        maxLength={3}
                      />
                      <FormField
                        label="PIN credential identity"
                        value={member}
                        onChangeText={setMember}
                        keyboardType="number-pad"
                        maxLength={3}
                      />
                      <FormField
                        label="PIN credential slot"
                        value={slot}
                        onChangeText={setSlot}
                        keyboardType="number-pad"
                        maxLength={1}
                      />
                    </>
                  )}
                </>
              )}
              {error && (
                <AppText accessibilityRole="alert" className="text-danger">
                  {error}
                </AppText>
              )}
              <AppText className="text-xs text-muted">
                Wrong or interrupted authentication can use an attempt. VaultPass never retries your PIN automatically.
              </AppText>
              <Button
                label="Continue to tap"
                disabled={!valid}
                onPress={() => {
                  try {
                    finish({
                      profile:
                        request?.profile && !request.editProfile
                          ? request.profile
                          : pinProfile({
                              identityId: Number(identity),
                              credentialIdentityId: Number(member),
                              credentialSlot: Number(slot),
                            }),
                      password,
                    });
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Check your card access profile.');
                  }
                }}
              />
              <Button variant="secondary" label="Cancel" onPress={() => finish(null)} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Context.Provider>
  );
}
