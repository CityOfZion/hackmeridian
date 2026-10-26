import { Asset, Networks, StrKey } from '@stellar/stellar-sdk/base';

import { ASSET_CODE } from '@/constants';
import i18n from '@/i18n';

/**
 * Stellar network for funds: `mainnet` (default, real EURC) or `testnet` (`EXPO_PUBLIC_STELLAR_NETWORK`). Funds
 * are EURC payments signed by the Pass and confirmed on a closed ledger before bunq.
 */
const NETWORKS = {
  mainnet: {
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: Networks.PUBLIC,
    // Circle's EURC
    eurcIssuer: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2',
  },
  testnet: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: Networks.TESTNET,
    eurcIssuer: 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO',
  },
};

const network = NETWORKS[process.env.EXPO_PUBLIC_STELLAR_NETWORK === 'testnet' ? 'testnet' : 'mainnet'];

export const HORIZON_URL = network.horizonUrl;
export const NETWORK_PASSPHRASE = network.passphrase;

/** Circle's EURC on the selected network; override with `EXPO_PUBLIC_STELLAR_EURC_ISSUER`. */
export const eurcAsset = () => new Asset(ASSET_CODE, process.env.EXPO_PUBLIC_STELLAR_EURC_ISSUER || network.eurcIssuer);

/** The account that receives funding payments (`EXPO_PUBLIC_STELLAR_RECEIVER`). */
export function receiverAddress(): string {
  const address = process.env.EXPO_PUBLIC_STELLAR_RECEIVER?.trim();
  if (!address || !StrKey.isValidEd25519PublicKey(address)) {
    throw new Error(i18n.t('common:errors.stellar.receiverMissing'));
  }
  return address;
}

/** Seconds a signed funding payment stays valid. Past it, the network rejects the transaction, so a late landing can't happen. */
export const PAYMENT_TIMEOUT_SECONDS = 180;
