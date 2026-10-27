# ITEM P-256 smart accounts on Stellar mainnet

VaultPass scans the ITEM card through an authenticated tunnel. On first use it asks for the 32-byte application pairing key and saves it in the phone's SecureStore after verifying a card signature. Subsequent scans use that cached key. The pairing key is never sent to the backend. The active KeyRing must contain a 65-byte uncompressed P-256 public key. A card whose pinned key changes requires explicit re-enrollment with the pairing key.

The backend issues a 32-byte, two-minute challenge bound to a secret HMAC. The card signs that digest directly, and the app sends only the public key, signature, digest, and challenge token to the backend. The backend verifies the proof, derives a mainnet C-address from the public key, and checks on-chain code and authority. If absent and account creation is enabled, OpenZeppelin Channels pays for deployment of the OpenZeppelin v0.8 smart account with exactly one default `External` signer: the ITEM P-256 key and the raw P-256 verifier. The shared deployer Ed25519 key signs only the one-time contract creation authorization. It is not installed as a smart-account signer or policy. Existing accounts with different code or authority fail closed.

The dashboard reads XLM, USDC, and EURC token balances for that C-address through Soroban RPC. It does not offer the old G-account trustline or funding actions. Those need a separate P-256 Soroban authorization flow before they can be used with this account.

## Mainnet setup

The raw P-256 verifier is deployed at `CA5ZJMYHPBW6ZSA5OYAJD3L54MHAN5PUKY5FVT7DXZIZ42YGTSDNRSQF`. Its on-chain WASM SHA-256 is `8ef4a1475a6107fed08d3e07e60c44ded121b24685a0cada25ee7e121bfd3a51`, matching the build in this repository. It has no storage, admin, or upgrade entrypoint.

1. Copy `backend/.env.example` to `backend/.env` (git-ignored). Generate a mainnet [OpenZeppelin Channels API key](https://channels.openzeppelin.com/gen), save it as `CHANNELS_API_KEY`, and set a random `CHALLENGE_SECRET` of at least 32 bytes. Keep both values out of `EXPO_PUBLIC_` variables. The verifier address is already filled in.
2. Set `ALLOW_ACCOUNT_CREATION=true` and start the backend with `node --env-file=backend/.env backend/src/server.mjs`. The server defaults to localhost; put it behind HTTPS before using a phone outside local development.
3. Set `EXPO_PUBLIC_VAULTPASS_API_URL` in the app to that HTTPS URL. For local Android development, an HTTP URL is accepted only in development builds; use USB reverse forwarding or a reachable development host.

To reproduce the verifier, use Rust 1.91.1 with `wasm32v1-none`: `cargo test --manifest-path contracts/p256-verifier/Cargo.toml` and `cargo build --release --target wasm32v1-none --manifest-path contracts/p256-verifier/Cargo.toml`. The resulting WASM must match the hash above. The contract is adapted from 3K1 Labs Latch's MIT-licensed P-256 verifier and has not had an independent audit. `pnpm --dir backend bootstrap:verifier` checks its deterministic address and ledger state. The bootstrap script requires both `BOOTSTRAP_MAINNET_VERIFIER=YES` and `--submit` to make on-chain changes; it reuses the existing deployment when the hash matches.

## Mainnet deployment, 27 October 2026

- WASM upload: [a2875eb5…c56bd](https://stellar.expert/explorer/public/tx/a2875eb5d24b41f3e91dab4373457b8760775c700849728c2cf38c04235c56bd), confirmed in ledger 65171139.
- Verifier deployment: [1aabda9c…164f9](https://stellar.expert/explorer/public/tx/1aabda9cbeb553e6f278323f29f0018037734620b07a88a14be42676ef2164f9), confirmed in ledger 65171141.

Both transactions were submitted through mainnet Channels and independently confirmed through Soroban RPC. The deployed verifier accepted a real card signature in a read-only RPC simulation.

A backend deployment is required for login and balance reads. The server holds a Channels API key and challenge secret, but no card signing key. Keep rate limits and TLS at the HTTPS edge if serving untrusted clients. The in-process replay and rate-limit maps reset on restart and do not coordinate across replicas; use shared storage before scaling the service horizontally.

## Physical card evidence, 27 October 2026

The attached Identiv reader opened the tunnel using the repository's default test pairing key without exposing it in logs, read firmware 3.0.0, and found one active KeyRing (ring 0). The exported public key was 65 bytes; a disposable 32-byte digest produced a 64-byte signature that verified as **direct P-256**, not double-hashed P-256 or secp256k1. No provisioning or card mutation was performed. This card already has its P-256 KeyRing active. The installed SDK does not provide a qualified kernel KeyRing switch for other cards, so this app checks the active ring and stops if it is not P-256.

The attached card completed the live backend flow: a server challenge was signed, the corresponding mainnet smart account was created, and its XLM, USDC, and EURC balances were read as zero. A second signed login returned the same account with `created: false`. On-chain inspection confirmed the expected OpenZeppelin account WASM, one default rule, exactly one external P-256 signer matching the card, zero policies, and no rule expiry. The deployer is not a signer. This qualification used the attached desktop reader and local backend; the updated phone UI and a publicly hosted backend have not been qualified.
