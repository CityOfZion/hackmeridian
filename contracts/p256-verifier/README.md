# VaultPass raw P-256 verifier

This Soroban verifier accepts the ITEM card's 65-byte uncompressed P-256 public key and 64-byte compact signature over the already computed OpenZeppelin smart-account auth digest. It is stateless and has no admin or upgrade entrypoint. VaultPass must normalize high-S card signatures before submission because Soroban's native verifier rejects them.

The implementation and tests are adapted from [3K1 Labs Latch Contracts](https://github.com/3K1-Labs/latch-contracts/tree/main/latch-verifiers/p256-verifier) under its MIT license. This copy targets `stellar-accounts` 0.8.0 and `soroban-sdk` 28.0.0 to match the OpenZeppelin mainnet account WASM identified in the deployment manifest. Review and build this exact source before mainnet deployment; a testnet contract address is not valid on mainnet.
