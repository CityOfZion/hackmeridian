import { p256 } from '@noble/curves/nist.js';
import {
  Address,
  Asset,
  Networks,
  StrKey,
  buildAuthorizationEntryPreimage,
  hash,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk/base';

/** Mainnet trust anchors. These cannot be supplied by the relay. */
export const TRANSFER_NETWORK = Networks.PUBLIC;
export const P256_VERIFIER = 'CA5ZJMYHPBW6ZSA5OYAJD3L54MHAN5PUKY5FVT7DXZIZ42YGTSDNRSQF';
export const ACCOUNT_DEPLOYER = 'GAAH4OT36RRCCAGKARGPN2HLHT2NOBVFHO4GUHA6CF7UKQ4MMV24WQ4N';
export const AUTH_LEDGER_TTL = 120;
export const TRANSFER_ASSETS = ['XLM', 'USDC', 'EURC'] as const;
export type TransferAsset = (typeof TRANSFER_ASSETS)[number];
export type TransferIntent = { asset: TransferAsset; recipient: string; amount: string };
export type AccountBinding = { account: string; ruleId: number };
export type PreparedTransfer = {
  ruleId?: number;
  id: string;
  network: string;
  account: string;
  verifier: string;
  func: string;
  auth: string;
  latestLedger: number;
  expirationLedger: number;
};
export type TransferState = 'prepared' | 'pending' | 'unknown' | 'confirmed' | 'failed' | 'expired';
export type TransferRecord = {
  prepared: PreparedTransfer;
  intent: TransferIntent;
  state: TransferState;
  hash?: string;
  ledger?: number;
  message?: string;
};

export const transferAsset = (code: TransferAsset): Asset => {
  switch (code) {
    case 'XLM':
      return Asset.native();
    case 'USDC':
      return new Asset(code, 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN');
    case 'EURC':
      return new Asset(code, 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2');
    default:
      throw new Error('Choose XLM, USDC or EURC.');
  }
};

/** Parse seven decimal places without floating point, bounded by SAC's classic-asset supply range. */
export function amountUnits(amount: string): bigint {
  if (typeof amount !== 'string' || !/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,7})?$/.test(amount)) {
    throw new Error('Enter an amount with at most seven decimal places.');
  }
  const [whole, fraction = ''] = amount.split('.');
  const units = BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, '0'));
  if (units <= 0n || units > 9_223_372_036_854_775_807n) throw new Error('The transfer amount is out of range.');
  return units;
}

export function validateIntent(intent: TransferIntent): TransferIntent {
  if (!intent || typeof intent.recipient !== 'string') throw new Error('Enter a Stellar recipient address.');
  transferAsset(intent.asset);
  if (!StrKey.isValidContract(intent.recipient) && !StrKey.isValidEd25519PublicKey(intent.recipient)) {
    throw new Error('Enter a Stellar G or C address.');
  }
  amountUnits(intent.amount);
  return { asset: intent.asset, recipient: intent.recipient, amount: intent.amount };
}

export function cardAccountAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== 65 || publicKey[0] !== 4) throw new Error('The Pass must use P-256.');
  p256.ProjectivePoint.fromHex(publicKey);
  const salt = hash(new Uint8Array([...new TextEncoder().encode('VaultPass ITEM P-256 account v1\0'), ...publicKey]));
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: hash(TRANSFER_NETWORK),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: Address.fromString(ACCOUNT_DEPLOYER).toScAddress(),
          salt,
        }),
      ),
    }),
  );
  return StrKey.encodeContract(hash(preimage.toXdr()));
}

export function transferFunction(account: string, intent: TransferIntent): string {
  validateIntent(intent);
  if (!StrKey.isValidContract(account)) throw new Error('Expected a smart account.');
  if (account === intent.recipient) throw new Error('Choose a recipient other than this account.');
  return xdr.HostFunction.hostFunctionTypeInvokeContract(
    new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(transferAsset(intent.asset).contractId(TRANSFER_NETWORK)).toScAddress(),
      functionName: 'transfer',
      args: [
        Address.fromString(account).toScVal(),
        Address.fromString(intent.recipient).toScVal(),
        nativeToScVal(amountUnits(intent.amount), { type: 'i128' }),
      ],
    }),
  ).toXdr('base64');
}

function credentials(entry: xdr.SorobanAuthorizationEntry): xdr.SorobanAddressCredentials {
  switch (entry.credentials.type) {
    case 'sorobanCredentialsAddress':
      return entry.credentials.address;
    case 'sorobanCredentialsAddressV2':
      return entry.credentials.addressV2;
    default:
      throw new Error('Unsupported transfer authorization.');
  }
}

function replaceCredentials(entry: xdr.SorobanAuthorizationEntry, value: xdr.SorobanAddressCredentials) {
  return new xdr.SorobanAuthorizationEntry({
    rootInvocation: entry.rootInvocation,
    credentials:
      entry.credentials.type === 'sorobanCredentialsAddressV2'
        ? xdr.SorobanCredentials.sorobanCredentialsAddressV2(value)
        : xdr.SorobanCredentials.sorobanCredentialsAddress(value),
  });
}

export function withExpiration(auth: string, expirationLedger: number): string {
  const entry = xdr.SorobanAuthorizationEntry.fromXdr(auth, 'base64');
  const c = credentials(entry);
  return replaceCredentials(
    entry,
    new xdr.SorobanAddressCredentials({
      address: c.address,
      nonce: c.nonce,
      signature: xdr.ScVal.scvVoid(),
      signatureExpirationLedger: expirationLedger,
    }),
  ).toXdr('base64');
}

/** Reject every deviation from the reviewed direct transfer, including extra/nested calls and changed authority. */
export function validatePreparedTransfer(
  prepared: PreparedTransfer,
  intent: TransferIntent,
  publicKey: Uint8Array,
  currentLedger: number,
  binding?: AccountBinding,
): void {
  validatePreparedCall(prepared, transferFunction(prepared.account, intent), publicKey, currentLedger, binding);
}

export function validatePreparedCall(
  prepared: PreparedTransfer,
  expectedFunction: string,
  publicKey: Uint8Array,
  currentLedger: number,
  binding?: AccountBinding,
): void {
  if (
    prepared.network !== TRANSFER_NETWORK ||
    prepared.verifier !== P256_VERIFIER ||
    prepared.account !== (binding?.account ?? cardAccountAddress(publicKey)) ||
    (prepared.ruleId ?? 0) !== (binding?.ruleId ?? 0) ||
    !Number.isInteger(prepared.ruleId ?? 0) ||
    (prepared.ruleId ?? 0) < 0 ||
    (prepared.ruleId ?? 0) > 0xffffffff
  ) {
    throw new Error('The transfer has an unexpected network, account or verifier.');
  }
  if (
    !Number.isSafeInteger(currentLedger) ||
    currentLedger <= 0 ||
    !Number.isSafeInteger(prepared.latestLedger) ||
    prepared.latestLedger > currentLedger ||
    !Number.isSafeInteger(prepared.expirationLedger) ||
    prepared.expirationLedger <= currentLedger ||
    prepared.expirationLedger > prepared.latestLedger + AUTH_LEDGER_TTL
  ) {
    throw new Error('This approval has expired or has an invalid expiry. Review the transfer again.');
  }
  if (prepared.func !== expectedFunction) throw new Error('The transfer does not match your payment.');
  const entry = xdr.SorobanAuthorizationEntry.fromXdr(prepared.auth, 'base64');
  const c = credentials(entry);
  const root = entry.rootInvocation;
  const func = xdr.HostFunction.fromXdr(prepared.func, 'base64');
  if (
    Address.fromScAddress(c.address).toString() !== prepared.account ||
    c.signature.type !== 'scvVoid' ||
    c.signatureExpirationLedger !== prepared.expirationLedger ||
    root.subInvocations.length !== 0 ||
    root.function.type !== 'sorobanAuthorizedFunctionTypeContractFn' ||
    func.type !== 'hostFunctionTypeInvokeContract' ||
    root.function.contractFn.toXdr('base64') !== func.invokeContract.toXdr('base64')
  ) {
    throw new Error('The authorization does not match your payment.');
  }
}

/** OpenZeppelin v0.8 AuthDigestPreimage, not the classic transaction hash or the v0.7 digest. */
export function transferDigest(prepared: PreparedTransfer): Uint8Array {
  const entry = xdr.SorobanAuthorizationEntry.fromXdr(prepared.auth, 'base64');
  const payload = hash(buildAuthorizationEntryPreimage(entry, prepared.expirationLedger, TRANSFER_NETWORK).toXdr());
  const preimage = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('account'), val: Address.fromString(prepared.account).toScVal() }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('context_rule_ids'),
      val: xdr.ScVal.scvVec([xdr.ScVal.scvU32(prepared.ruleId ?? 0)]),
    }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('signature_payload'), val: xdr.ScVal.scvBytes(payload) }),
  ]);
  return hash(preimage.toXdr());
}

export function signedTransferAuth(
  prepared: PreparedTransfer,
  publicKey: Uint8Array,
  signature: Uint8Array,
  binding?: AccountBinding,
): string {
  if (
    (binding?.account ?? cardAccountAddress(publicKey)) !== prepared.account ||
    (binding?.ruleId ?? 0) !== (prepared.ruleId ?? 0) ||
    prepared.network !== TRANSFER_NETWORK ||
    prepared.verifier !== P256_VERIFIER ||
    signature.length !== 64 ||
    !p256.verify(signature, transferDigest(prepared), publicKey, { lowS: true, prehash: false })
  ) {
    throw new Error('The Pass signature does not authorize this transfer.');
  }
  const entry = xdr.SorobanAuthorizationEntry.fromXdr(prepared.auth, 'base64');
  const c = credentials(entry);
  const payload = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('context_rule_ids'),
      val: xdr.ScVal.scvVec([xdr.ScVal.scvU32(prepared.ruleId ?? 0)]),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('signers'),
      val: xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol('External'),
            Address.fromString(P256_VERIFIER).toScVal(),
            xdr.ScVal.scvBytes(publicKey),
          ]),
          val: xdr.ScVal.scvBytes(signature),
        }),
      ]),
    }),
  ]);
  return replaceCredentials(
    entry,
    new xdr.SorobanAddressCredentials({
      address: c.address,
      nonce: c.nonce,
      signatureExpirationLedger: c.signatureExpirationLedger,
      signature: payload,
    }),
  ).toXdr('base64');
}
