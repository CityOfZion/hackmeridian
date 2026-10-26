import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { NfcRings } from '@/components/nfc/nfc-rings';
import { AppText, Eyebrow } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ResultBadge } from '@/components/ui/result-badge';
import { cancelNfiScan, TAP_STEPS, tapStepMessage } from '@/hooks/use-item-nfi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectPassTap, tapDismissed } from '@/store/slices/pass-tap-slice';
import { cn } from '@/utils/cn';

/** How long the success state stays up before the modal closes on its own. */
const SUCCESS_DISMISS_MS = 900;

/**
 * Bottom sheet shown while a Pass tap runs (any `usePassTap` call): pulsing rings, the current step as a status
 * message, and a progress bar. Android only; iOS shows its own NFC sheet with the same messages. Mounted once in
 * app.tsx.
 */
export function PassTapModal() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const tap = useAppSelector(selectPassTap);
  const visible = Platform.OS === 'android' && tap.phase !== 'idle';
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      slide.setValue(0);
      return;
    }
    Animated.timing(slide, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  useEffect(() => {
    if (tap.phase !== 'success') return;
    const timeout = setTimeout(() => dispatch(tapDismissed()), SUCCESS_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [tap.phase, dispatch]);

  const stepIndex = tap.step ? TAP_STEPS.indexOf(tap.step) : -1;
  const progress = tap.phase === 'success' ? 1 : (stepIndex + 1) / TAP_STEPS.length;
  const close = () => {
    if (tap.phase === 'active') cancelNfiScan();
    else dispatch(tapDismissed());
  };

  const eyebrow = {
    idle: '',
    active: t('tap.modal.eyebrowActive'),
    success: t('tap.modal.eyebrowSuccess'),
    error: t('tap.modal.eyebrowError'),
  }[tap.phase];
  const status =
    tap.phase === 'success'
      ? t('tap.modal.verified')
      : tap.phase === 'error'
        ? tap.error
        : tapStepMessage(tap.step ?? 'waiting');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <View className="flex-1 justify-end bg-black/85 px-3 pb-safe-offset-3">
        <Animated.View
          className="w-full max-w-100 self-center rounded-3xl border border-brass bg-panel px-6 pt-7 pb-6"
          style={{
            opacity: slide,
            transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
          }}
        >
          {tap.phase === 'active' && <NfcRings />}
          {tap.phase === 'success' && <ResultBadge icon="check" tone="success" round />}
          {tap.phase === 'error' && <ResultBadge icon="close" tone="danger" round />}

          <Eyebrow className="text-center">{eyebrow}</Eyebrow>
          <AppText className="mt-2 text-center font-outfit-semibold text-xl text-paper">{tap.title}</AppText>
          <AppText
            accessibilityLiveRegion="polite"
            className={cn(
              'mt-3 min-h-10 text-center text-sm leading-normal text-muted',
              tap.phase === 'error' && 'text-danger',
            )}
          >
            {status}
          </AppText>

          {tap.phase !== 'error' && (
            <View className="mt-4">
              <View className="h-1 overflow-hidden rounded-full bg-line">
                <View
                  className="h-full rounded-full bg-brass"
                  style={{ width: `${Math.max(progress, 0.04) * 100}%` }}
                />
              </View>
              <AppText className="mt-2 text-center text-3xs tracking-widest text-muted">
                {tap.phase === 'success'
                  ? t('tap.modal.progressDone')
                  : t('tap.modal.progress', { current: Math.max(stepIndex + 1, 1), total: TAP_STEPS.length })}
              </AppText>
            </View>
          )}

          {tap.phase !== 'success' && (
            <Button
              variant="secondary"
              label={tap.phase === 'error' ? t('actions.close') : t('actions.cancel')}
              onPress={close}
              className="mt-5"
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
