import { FREEZE_POLICY } from '../../src/api/stellar/freeze-codec.ts';
import { FREEZE_WASM_HASH } from './freeze-release.mjs';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';

import { ChannelsClient } from '@openzeppelin/relayer-plugin-channels';
import { Address, Asset, buildAuthorizationEntryPreimage, hash, xdr } from '@stellar/stellar-sdk';
import { Api, Server } from '@stellar/stellar-sdk/rpc';
import { Client as SmartAccountClient } from 'smart-account-kit-bindings';

import {
  ACCOUNT_WASM_HASH,
  DEPLOYER,
  NETWORK_PASSPHRASE,
  accountAddress,
  accountSalt,
  publicKeyBytes,
} from './account.mjs';

export const VERIFIER_WASM_HASH = '8ef4a1475a6107fed08d3e07e60c44ded121b24685a0cada25ee7e121bfd3a51';
const RPC_URL = process.env.STELLAR_RPC_URL || 'https://mainnet.sorobanrpc.com';
const rpc = new Server(RPC_URL);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function contractInstanceKey(address) {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: Address.fromString(address).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );
}

async function instanceHash(address) {
  const entries = await rpc.getLedgerEntries(contractInstanceKey(address));
  const executable = entries.entries?.[0]?.val?.contractData()?.val()?.instance()?.executable();
  if (!executable) return null;
  if (executable.switch().name !== 'contractExecutableWasm') throw new Error('Unexpected contract executable');
  return Buffer.from(executable.wasmHash()).toString('hex');
}

function expectedSigner(publicKey, verifierAddress) {
  return { tag: 'External', values: [verifierAddress, Buffer.from(publicKey)] };
}

export function accountClient(address) {
  return new SmartAccountClient({
    contractId: address,
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    publicKey: DEPLOYER.publicKey(),
  });
}

export async function accountAuthority(address, verifierAddress) {
  const wasmHash = await instanceHash(address);
  if (wasmHash === null) return null;
  if (wasmHash !== ACCOUNT_WASM_HASH) throw new Error('Unexpected smart account code');
  const wallet = accountClient(address);
  const count = (await wallet.get_context_rules_count()).result;
  // This wallet supports append-only independent card rules. Unknown policies/removals fail closed.
  if (!Number.isInteger(count) || count < 1 || count > 15) throw new Error('Unsupported account authority');
  const rules = await Promise.all(
    Array.from({ length: count }, (_, id) => wallet.get_context_rule({ context_rule_id: id }).then((tx) => tx.result)),
  );
  const authority = validateAuthority(rules, verifierAddress);
  if (authority.some((r) => r.protected) && (await instanceHash(FREEZE_POLICY)) !== FREEZE_WASM_HASH)
    throw new Error('Unexpected freeze policy code');
  if (accountAddress(publicKeyBytes(authority[0].publicKey)) !== address) throw new Error('Unexpected account origin');
  return authority;
}
export function validateAuthority(rules, verifierAddress) {
  const keys = new Set();
  return rules.map((rule, id) => {
    const signer = rule?.signers?.[0];
    if (
      rule.id !== id ||
      rule.context_type?.tag !== 'Default' ||
      rule.signers.length !== 1 ||
      (rule.policies.length !== 0 && (rule.policies.length !== 1 || rule.policies[0] !== FREEZE_POLICY)) ||
      rule.valid_until != null ||
      signer?.tag !== 'External' ||
      signer.values[0] !== verifierAddress
    )
      throw new Error('Unexpected smart account authority');
    const publicKey = Buffer.from(signer.values[1]).toString('hex');
    publicKeyBytes(publicKey);
    if (keys.has(publicKey)) throw new Error('Duplicate card authority');
    keys.add(publicKey);
    return { ruleId: id, publicKey, ...(rule.policies.length ? { protected: true } : {}) };
  });
}
async function verifyAccount(address, publicKey, verifierAddress) {
  const rules = await accountAuthority(address, verifierAddress);
  if (!rules) return false;
  if (!rules.some((rule) => rule.publicKey === Buffer.from(publicKey).toString('hex')))
    throw new Error('This card is not authorized for the smart account');
  return true;
}

function addressSignature(publicKey, signature) {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('public_key'), val: xdr.ScVal.scvBytes(publicKey) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('signature'), val: xdr.ScVal.scvBytes(signature) }),
    ]),
  ]);
}

function randomNonce() {
  return xdr.Int64.fromString(randomBytes(8).readBigInt64BE().toString());
}

export function signCreation(assembled) {
  const operation = assembled.built?.operations[0];
  const auth = assembled.simulationData?.result?.auth ?? [];
  const latestLedger = assembled.simulation?.latestLedger;
  if (
    assembled.built?.operations.length !== 1 ||
    operation?.type !== 'invokeHostFunction' ||
    operation.func.switch().name !== 'hostFunctionTypeCreateContractV2' ||
    auth.length !== 1 ||
    latestLedger === undefined
  )
    throw new Error('Deployment simulation did not return one contract creation');

  const authorized = auth[0].rootInvocation().function();
  if (
    authorized.switch().name !== 'sorobanAuthorizedFunctionTypeCreateContractV2HostFn' ||
    !Buffer.from(authorized.createContractV2HostFn().toXDR()).equals(operation.func.createContractV2().toXDR()) ||
    auth[0].rootInvocation().subInvocations().length !== 0
  )
    throw new Error('Deployment authorization does not match contract creation');

  const expiration = latestLedger + 720;
  const credentials = new xdr.SorobanAddressCredentials({
    address: Address.fromString(DEPLOYER.publicKey()).toScAddress(),
    nonce: randomNonce(),
    signatureExpirationLedger: expiration,
    signature: xdr.ScVal.scvVoid(),
  });
  const entry = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(credentials),
    rootInvocation: auth[0].rootInvocation(),
  });
  const preimage = buildAuthorizationEntryPreimage(entry, expiration, NETWORK_PASSPHRASE);
  credentials.signature(addressSignature(DEPLOYER.rawPublicKey(), DEPLOYER.sign(hash(preimage.toXDR()))));
  return { func: operation.func.toXDR('base64'), auth: [entry.toXDR('base64')] };
}

async function buildDeployment(publicKey, verifierAddress) {
  const policies = new Map();
  if (process.env.ALLOW_FREEZE === 'true') {
    if ((await instanceHash(FREEZE_POLICY)) !== FREEZE_WASM_HASH)
      throw new Error('Freeze policy is not deployed with reviewed code');
    policies.set(FREEZE_POLICY, xdr.ScVal.scvVoid());
  }
  const assembled = await SmartAccountClient.deploy(
    { signers: [expectedSigner(publicKey, verifierAddress)], policies },
    {
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      wasmHash: ACCOUNT_WASM_HASH,
      address: DEPLOYER.publicKey(),
      salt: accountSalt(publicKey),
      timeoutInSeconds: 60,
    },
  );
  return signCreation(assembled);
}

async function waitForDeployment(hashValue, address, publicKey, verifierAddress) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const transaction = await rpc.getTransaction(hashValue);
    if (transaction.status === Api.GetTransactionStatus.FAILED) throw new Error('Account deployment failed on-chain');
    if (transaction.status === Api.GetTransactionStatus.SUCCESS) {
      if (await verifyAccount(address, publicKey, verifierAddress)) return;
      throw new Error('Deployment succeeded but the card-only account was not found');
    }
    await delay(2500);
  }
  throw new Error('Account deployment is still pending; check again before retrying');
}

export async function resolveAccount(publicKey, { allowCreation = false } = {}) {
  const verifierAddress = process.env.P256_VERIFIER_ADDRESS;
  if (!verifierAddress) throw new Error('P256_VERIFIER_ADDRESS is not configured');
  const address = accountAddress(publicKey);
  if (await verifyAccount(address, publicKey, verifierAddress)) return { address, created: false };

  if (!allowCreation) throw new Error('Account creation is disabled');
  const verifierHash = await instanceHash(verifierAddress);
  if (verifierHash !== VERIFIER_WASM_HASH)
    throw new Error('The configured P-256 verifier is missing or has different code');
  const apiKey = process.env.CHANNELS_API_KEY;
  if (!apiKey) throw new Error('CHANNELS_API_KEY is not configured');
  const deployment = await buildDeployment(publicKey, verifierAddress);
  const channels = new ChannelsClient({ baseUrl: 'https://channels.openzeppelin.com', apiKey });
  try {
    const result = await channels.submitSorobanTransaction(deployment);
    if (!result.hash) throw new Error('Channels did not return a transaction hash');
    await waitForDeployment(result.hash, address, publicKey, verifierAddress);
  } catch (error) {
    // A lost response may still have produced a contract. Inspect exact code and authority before returning.
    if (!(await verifyAccount(address, publicKey, verifierAddress))) throw error;
  }
  return { address, created: true };
}

const USDC = new Asset(
  'USDC',
  process.env.STELLAR_USDC_ISSUER || 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
);
const EURC = new Asset(
  'EURC',
  process.env.STELLAR_EURC_ISSUER || 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2',
);

function units(balance) {
  return Number(BigInt(balance.balanceEntry?.amount ?? '0')) / 10_000_000;
}

export async function accountBalances(address, publicKey) {
  const verifierAddress = process.env.P256_VERIFIER_ADDRESS;
  if (!verifierAddress || !(await verifyAccount(address, publicKey, verifierAddress))) {
    throw new Error('The card-only smart account is not deployed');
  }
  const [xlm, usdc, eurc] = await Promise.all([
    rpc.getAssetBalance(address, Asset.native(), NETWORK_PASSPHRASE),
    rpc.getAssetBalance(address, USDC, NETWORK_PASSPHRASE),
    rpc.getAssetBalance(address, EURC, NETWORK_PASSPHRASE),
  ]);
  return { address, xlmBalance: units(xlm), balances: { USDC: units(usdc), EURC: units(eurc) }, exists: true };
}

export { rpc, instanceHash, verifyAccount, buildDeployment };
