import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';

import { ChannelsClient } from '@openzeppelin/relayer-plugin-channels';
import { contract, hash, xdr } from '@stellar/stellar-sdk';
import { Api } from '@stellar/stellar-sdk/rpc';

import { contractAddress, DEPLOYER, NETWORK_PASSPHRASE } from '../src/account.mjs';
import { VERIFIER_WASM_HASH, instanceHash, rpc, signCreation } from '../src/stellar.mjs';

const WASM_HASH = VERIFIER_WASM_HASH;
const SALT = hash(Buffer.from('VaultPass ITEM raw P-256 verifier v1'));
const ADDRESS = contractAddress(SALT);
const WASM_PATH = new URL(
  '../../contracts/p256-verifier/target/wasm32v1-none/release/vaultpass_p256_verifier.wasm',
  import.meta.url,
);

const codeKey = xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({ hash: Buffer.from(WASM_HASH, 'hex') }));

async function codeExists() {
  return (await rpc.getLedgerEntries(codeKey)).entries?.length === 1;
}

async function waitFor(hashValue) {
  for (let i = 0; i < 24; i++) {
    const transaction = await rpc.getTransaction(hashValue);
    if (transaction.status === Api.GetTransactionStatus.FAILED)
      throw new Error(`Mainnet transaction ${hashValue} failed`);
    if (transaction.status === Api.GetTransactionStatus.SUCCESS) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Mainnet transaction ${hashValue} is pending; inspect it before retrying`);
}

const wasm = await readFile(WASM_PATH);
if (hash(wasm).toString('hex') !== WASM_HASH) throw new Error('Built verifier WASM does not match reviewed hash');
const deployedHash = await instanceHash(ADDRESS);
if (deployedHash && deployedHash !== WASM_HASH) throw new Error('Predicted verifier address contains different code');
console.log(
  JSON.stringify({
    network: 'mainnet',
    verifierAddress: ADDRESS,
    wasmHash: WASM_HASH,
    codeUploaded: await codeExists(),
    deployed: deployedHash === WASM_HASH,
  }),
);

if (process.argv.includes('--submit') && !deployedHash) {
  if (process.env.BOOTSTRAP_MAINNET_VERIFIER !== 'YES')
    throw new Error('Set BOOTSTRAP_MAINNET_VERIFIER=YES to submit mainnet transactions');
  if (!process.env.CHANNELS_API_KEY) throw new Error('Set CHANNELS_API_KEY in the backend environment');
  const channels = new ChannelsClient({
    baseUrl: 'https://channels.openzeppelin.com',
    apiKey: process.env.CHANNELS_API_KEY,
  });
  if (!(await codeExists())) {
    const func = xdr.HostFunction.hostFunctionTypeUploadContractWasm(wasm).toXDR('base64');
    const uploaded = await channels.submitSorobanTransaction({ func, auth: [] });
    await waitFor(uploaded.hash);
    if (!(await codeExists())) throw new Error('WASM upload was confirmed but code is missing');
  }
  const deployment = await contract.Client.deploy(undefined, {
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: process.env.STELLAR_RPC_URL || 'https://mainnet.sorobanrpc.com',
    wasmHash: WASM_HASH,
    address: DEPLOYER.publicKey(),
    salt: SALT,
    timeoutInSeconds: 60,
  });
  const submitted = await channels.submitSorobanTransaction(signCreation(deployment));
  await waitFor(submitted.hash);
  if ((await instanceHash(ADDRESS)) !== WASM_HASH)
    throw new Error('Verifier deployment was confirmed but code differs');
  console.log(`P256_VERIFIER_ADDRESS=${ADDRESS}`);
}
