import { Asset, Networks, StrKey } from '@stellar/stellar-sdk/base';

import { ASSET_CODE } from '@/constants';
import i18n from '@/i18n';

/**
 * Stellar network for funds: `mainnet` (default, real USDC) or `testnet` (`EXPO_PUBLIC_STELLAR_NETWORK`). Funds
 * are USDC payments signed by the Pass and confirmed on a closed ledger before bunq.
 */
const NETWORKS = {
  mainnet: {
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: Networks.PUBLIC,
    // Circle's USDC
    usdcIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  },
  testnet: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: Networks.TESTNET,
    usdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  },
};

const network = NETWORKS[process.env.EXPO_PUBLIC_STELLAR_NETWORK === 'testnet' ? 'testnet' : 'mainnet'];

export const HORIZON_URL = network.horizonUrl;
export const NETWORK_PASSPHRASE = network.passphrase;

/** Circle's USDC on the selected network; override with `EXPO_PUBLIC_STELLAR_USDC_ISSUER`. */
export const usdcAsset = () => new Asset(ASSET_CODE, process.env.EXPO_PUBLIC_STELLAR_USDC_ISSUER || network.usdcIssuer);

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
