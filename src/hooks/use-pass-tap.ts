import { useState } from 'react';
import { useCardPin } from '@/components/nfc/card-pin-provider';
import { loadCredential } from '@/api/item/card-signing';
import type { PinInput, PinProfile } from '@/api/item/card-auth';
import { claimCardAction } from '@/api/item/card-operation';

import { NfiScanError, type PassSignature, type TapStep, useScanItemNfi } from '@/hooks/use-item-nfi';
import i18n from '@/i18n';
import { accountChallenge, resolveSmartAccount } from '@/api/stellar/smart-account';
import { hex } from '@/api/item/card-crypto';
import { keyBytes } from '@/wallet/model';
import { cardAccountAddress } from '@/api/stellar/transfer-codec';
import { updateWallet } from '@/store/slices/wallet-slice';
import { useAppDispatch } from '@/store/hooks';
import { tapDismissed, tapFailed, tapStarted, tapStepChanged, tapSucceeded } from '@/store/slices/pass-tap-slice';

/**
 * Authenticates the Pass over NFC and has it sign: a server-issued challenge to sign in (`tapPass`), or a given digest
 * such as an OpenZeppelin Soroban authorization digest (`signWithPass`). `simulateTap` stands in for the chip in demos and on devices
 * without an NFC reader.
 */
export function usePassTap() {
  const dispatch = useAppDispatch();
  const askPin = useCardPin();
  const { scanItemNfi, isNfiScanAvailable } = useScanItemNfi();
  const [isTapping, setIsTapping] = useState(false);
  const [error, setError] = useState<string>();

  const run = async <T>(
    title: string,
    read: (onStep: (step: TapStep) => void, pin?: PinInput, uid?: string) => Promise<T | null>,
    onPairingKeyRequired?: (uid?: string) => void,
    expectedUid?: string,
    forcePin = false,
    preferredProfile?: PinProfile,
  ): Promise<T | null> => {
    let release: () => void;
    try {
      release = claimCardAction();
    } catch {
      setError('Another card action is in progress.');
      return null;
    }
    setError(undefined);
    setIsTapping(true);
    dispatch(tapDismissed());
    let pin: PinInput | null | undefined;
    const steps = (step: TapStep) => dispatch(tapStepChanged(step));
    try {
      const saved = expectedUid ? await loadCredential(expectedUid) : null;
      if (saved?.mode === 'pin' || forcePin) {
        if (!expectedUid) throw new Error('Identify the card before entering its PIN.');
        pin = await askPin({
          title,
          uid: expectedUid,
          profile: preferredProfile ?? (saved?.mode === 'pin' ? saved.profile : undefined),
        });
        if (!pin) return null;
      }
      dispatch(tapStarted(title));
      let result: T | null;
      try {
        result = await read(steps, pin ?? undefined, expectedUid);
      } catch (e) {
        // Only read-only discovery may lead to another tap. Never repeat a PAKE BEGIN or signing attempt.
        if (!(e instanceof NfiScanError) || e.code !== 'pin-required' || !e.uid || pin) throw e;
        dispatch(tapDismissed());
        const known = await loadCredential(e.uid);
        pin = await askPin({
          title,
          uid: e.uid,
          profile: known?.mode === 'pin' ? known.profile : undefined,
        });
        if (!pin) return null;
        dispatch(tapStarted(title));
        result = await read(steps, pin, e.uid);
      }
      dispatch(result === null ? tapDismissed() : tapSucceeded());
      return result;
    } catch (tapError) {
      if (
        tapError instanceof NfiScanError &&
        (tapError.code === 'pairing-key-required' || tapError.code === 'key-changed') &&
        onPairingKeyRequired
      ) {
        dispatch(tapDismissed());
        onPairingKeyRequired(tapError.uid);
        return null;
      }
      const message = tapError instanceof Error ? tapError.message : i18n.t('common:errors.readPass');
      setError(message);
      dispatch(tapFailed(message));
      return null;
    } finally {
      if (pin) pin.password = '';
      release();
      setIsTapping(false);
    }
  };

  /**
   * Sign-in: resolves a card-only mainnet smart account after a verified server challenge.
   * `onPairingKeyRequired` opens re-enrollment when the pairing key is missing or the active key changed.
   */
  const tapPass = (
    alertMessage: string,
    pairingKey?: string,
    onPairingKeyRequired?: (uid?: string) => void,
    expectedUid?: string,
    options: {
      forcePin?: boolean;
      allowAccountChange?: boolean;
      ring?: number;
      name?: string;
      pinProfile?: PinProfile;
      expectedPublicKey?: string;
    } = {},
  ) =>
    run(
      alertMessage,
      async (onStep, pin, uid) => {
        const challenge = await accountChallenge();
        const proof = await scanItemNfi(alertMessage, {
          pairingKey,
          pin,
          cachePin: true,
          digest: challenge.digest,
          expectedUid: uid,
          onStep,
          allowAccountChange: options.allowAccountChange,
          ring: options.ring,
          expectedPublicKey: options.expectedPublicKey,
        });
        if (!proof) return null;
        const account = await resolveSmartAccount(proof, challenge);
        if (!account.exists) throw new Error('The service returned an unexpected smart account.');
        const publicKey = hex(proof.publicKey);
        const verifiedAt = new Date().toISOString();
        const memberships = account.accounts ?? [
          {
            address: account.address,
            ruleId: account.ruleId ?? 0,
            originPublicKey: account.originPublicKey ?? publicKey,
          },
        ];
        if (!memberships.length || memberships.length > 15) throw new Error('Invalid account memberships.');
        for (const membership of [...memberships].reverse()) {
          if (membership.address !== cardAccountAddress(keyBytes(membership.originPublicKey)))
            throw new Error('Unexpected account identity.');
          await dispatch(
            updateWallet({
              type: 'enroll',
              account: {
                id: membership.address,
                originPublicKey: membership.originPublicKey,
                ruleId: membership.ruleId,
                cardUid: proof.uid,
                publicKey,
                name: options.name ?? `Keychain ${proof.ring}`,
                ring: proof.ring,
                verifiedAt,
              },
              card: {
                uid: proof.uid,
                name: 'My VaultPass',
                publicKey,
                ring: proof.ring,
                ringCount: proof.ringCount,
                firmware: proof.firmware,
                verifiedAt,
              },
            }),
          ).unwrap();
        }
        return proof.uid;
      },
      onPairingKeyRequired,
      expectedUid,
      options.forcePin,
      options.pinProfile,
    );
  /** Signs exactly `digest` with the Pass `expectedUid`; the signature is verified against its pinned key. */
  const signWithPass = (
    alertMessage: string,
    digest: Uint8Array,
    expectedUid: string,
    expectedPublicKey?: string,
    ring?: number,
  ) =>
    run<PassSignature>(
      alertMessage,
      (onStep, pin, uid) =>
        scanItemNfi(alertMessage, { digest, expectedUid: uid, expectedPublicKey, ring, pin, cachePin: true, onStep }),
      undefined,
      expectedUid,
    );
  /** Prove a candidate card without deploying or switching its wallet account. */
  const proveWithPass = (
    title: string,
    digest: Uint8Array,
    pairingKey?: string,
    onPairingKeyRequired?: (uid?: string) => void,
  ) =>
    run<PassSignature>(
      title,
      (onStep, pin, uid) =>
        scanItemNfi(title, {
          digest,
          pin,
          cachePin: true,
          pairingKey,
          expectedUid: uid,
          onStep,
          allowAccountChange: true,
        }),
      onPairingKeyRequired,
    );
  // No modal: nothing is read
  const simulateTap = (chipId: string) => {
    console.log('[nfi] simulated tap (no chip read)');
    return Promise.resolve(chipId);
  };

  return { tapPass, proveWithPass, signWithPass, simulateTap, isTapping, error, setError, isNfiScanAvailable };
}
