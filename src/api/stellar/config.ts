import { Asset, Networks, StrKey } from '@stellar/stellar-sdk/base';

import { CARD_ASSET_CODE, type PayAsset } from '@/constants';
import i18n from '@/i18n';

/**
 * Stellar network for funds: `mainnet` (default, real money) or `testnet` (`EXPO_PUBLIC_STELLAR_NETWORK`). A funding
 * is a path payment signed by the Pass: USDC from the vault, converted on Stellar's exchange, EURC to the receiver,
 * confirmed on a closed ledger before bunq.
 */
const NETWORKS = {
  mainnet: {
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: Networks.PUBLIC,
    // Circle's USDC and EURC
    usdcIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    eurcIssuer: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2',
  },
  testnet: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: Networks.TESTNET,
    usdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    eurcIssuer: 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO',
  },
};

const network = NETWORKS[process.env.EXPO_PUBLIC_STELLAR_NETWORK === 'testnet' ? 'testnet' : 'mainnet'];

export const HORIZON_URL = network.horizonUrl;
export const NETWORK_PASSPHRASE = network.passphrase;

const issuers: Record<PayAsset, () => string> = {
  USDC: () => process.env.EXPO_PUBLIC_STELLAR_USDC_ISSUER || network.usdcIssuer,
  EURC: () => process.env.EXPO_PUBLIC_STELLAR_EURC_ISSUER || network.eurcIssuer,
};

/** Circle's USDC or EURC on the selected network (`EXPO_PUBLIC_STELLAR_<CODE>_ISSUER` overrides the issuer). */
export const stellarAsset = (code: PayAsset) => new Asset(code, issuers[code]());

/** What the receiver gets per funding: EURC. */
export const cardAsset = () => stellarAsset(CARD_ASSET_CODE);

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
