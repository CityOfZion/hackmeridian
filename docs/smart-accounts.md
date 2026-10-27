# ITEM P-256 smart accounts on Stellar mainnet

VaultPass scans the ITEM card through an authenticated tunnel. On first use it asks for the 32-byte application pairing key and saves it in the phone's SecureStore after verifying a card signature. Subsequent scans use that cached key. The pairing key is never sent to the backend. The active KeyRing must contain a 65-byte uncompressed P-256 public key. A card whose pinned key changes requires explicit re-enrollment with the pairing key.

The backend issues a 32-byte, two-minute challenge bound to a secret HMAC. The card signs that digest directly, and the app sends only the public key, signature, digest, and challenge token to the backend. The backend verifies the proof, derives a mainnet C-address from the public key, and checks on-chain code and authority. If absent and account creation is enabled, OpenZeppelin Channels pays for deployment of the OpenZeppelin v0.8 smart account with exactly one default `External` signer: the ITEM P-256 key and the raw P-256 verifier. The shared deployer Ed25519 key signs only the one-time contract creation authorization. It is not installed as a smart-account signer or policy. Existing accounts with different code or authority fail closed.

The dashboard reads XLM, USDC, and EURC token balances for that C-address through Soroban RPC. It does not offer the old G-account trustline or funding actions. Those need a separate P-256 Soroban authorization flow before they can be used with this account.

## Mainnet setup

1. Build and test the verifier with Rust 1.91.1 or later and `wasm32v1-none`: `cargo test --manifest-path contracts/p256-verifier/Cargo.toml` and `cargo build --release --target wasm32v1-none --manifest-path contracts/p256-verifier/Cargo.toml`. The WASM SHA-256 must be `8ef4a1475a6107fed08d3e07e60c44ded121b24685a0cada25ee7e121bfd3a51`. The contract is adapted from 3K1 Labs Latch's MIT-licensed P-256 verifier; review it before deploying with real funds.
2. Generate a mainnet [OpenZeppelin Channels API key](https://channels.openzeppelin.com/gen). Set it as `CHANNELS_API_KEY` in the backend environment, never in an `EXPO_PUBLIC_` variable. Set a random `CHALLENGE_SECRET` of at least 32 bytes.
3. Run `pnpm --dir backend bootstrap:verifier` to print the deterministic verifier C-address and current ledger state. To upload and deploy it on mainnet, run `BOOTSTRAP_MAINNET_VERIFIER=YES node --env-file=backend/.env backend/scripts/bootstrap-verifier.mjs --submit`. This uses the Channels subsidy and makes real on-chain transactions. The script verifies the reviewed WASM hash and deployed code hash. Set its printed address as `P256_VERIFIER_ADDRESS`.
4. Set `ALLOW_ACCOUNT_CREATION=true` and start the backend with `node --env-file=backend/.env backend/src/server.mjs`. The server defaults to localhost; put it behind HTTPS before using a phone outside local development. Set `EXPO_PUBLIC_VAULTPASS_API_URL` in the app to that HTTPS URL. For local Android development, an HTTP URL is accepted only in development builds.

A backend deployment is required for login and balance reads. The server holds a Channels API key and challenge secret, but no card signing key. Keep rate limits and TLS at the HTTPS edge if serving untrusted clients. The in-process replay and rate-limit maps reset on restart and do not coordinate across replicas; use shared storage before scaling the service horizontally.

## Physical card evidence, 27 October 2026

The attached Identiv reader opened the tunnel using the repository's default test pairing key without exposing it in logs, read firmware 3.0.0, and found one active KeyRing (ring 0). The exported public key was 65 bytes; a disposable 32-byte digest produced a 64-byte signature that verified as **direct P-256**, not double-hashed P-256 or secp256k1. No provisioning or card mutation was performed. This card already has its P-256 KeyRing active. The installed SDK does not provide a qualified kernel KeyRing switch for other cards, so this app checks the active ring and stops if it is not P-256.

No mainnet contract or account was deployed during this qualification. A live card-to-mainnet login and balance display still require the Channels key, verifier deployment, backend URL, and phone build to be configured.
