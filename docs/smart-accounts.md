# ITEM P-256 smart accounts on Stellar mainnet

VaultPass scans the ITEM card through an authenticated tunnel. On first use it asks for the 32-byte application pairing key and saves it in the phone's SecureStore after verifying a card signature. Subsequent scans use that cached key. The pairing key is never sent to the backend. The active KeyRing must contain a 65-byte uncompressed P-256 public key. A card whose pinned key changes requires explicit re-enrollment with the pairing key.

The backend issues a 32-byte, two-minute challenge bound to a secret HMAC. The card signs that digest directly, and the app sends only the public key, signature, digest, and challenge token to the backend. The backend verifies the proof, derives a mainnet C-address from the public key, and checks on-chain code and authority. If absent and account creation is enabled, OpenZeppelin Channels pays for deployment of the OpenZeppelin v0.8 smart account with exactly one default `External` signer: the ITEM P-256 key and the raw P-256 verifier. The shared deployer Ed25519 key signs only the one-time contract creation authorization. It is not installed as a smart-account signer or policy. Existing accounts with different code or authority fail closed.

The dashboard reads XLM, USDC, and EURC token balances for that C-address through Soroban RPC. Its Send tokens action supports direct Soroban token transfers approved by the P-256 card. The old G-account trustline, path-payment conversion, and bunq funding actions remain separate and are not exposed by this dashboard.

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

## Direct transfers, 28 October 2026

The Send tokens screen accepts a Stellar G or C recipient and an exact amount with up to seven decimal places. It supports mainnet XLM and the pinned Circle USDC/EURC assets. The recipient must already be able to receive the asset; this flow does not create G accounts, establish recipient trustlines, attach memos, or convert currencies.

1. `/transfers/prepare` checks the account code and the selected independent card rule, builds the token `transfer`, and records the authorization through RPC simulation. It sets a 120-ledger approval lifetime.
2. The phone checks the returned host function and authorization against its locally reviewed amount, recipient, token, deterministic card account, and pinned mainnet verifier. Extra authorization contexts, nested calls, unsupported credentials and changes to authority are rejected. A direct RPC read independently checks the expiry.
3. The phone builds OpenZeppelin v0.8's `AuthDigestPreimage` with the account address, selected rule ID (0 for the original card), and Soroban authorization payload. Both V1 and V2 address credentials are supported. The card signs this final digest directly; the phone normalizes low-S and verifies strictly as P-256.
4. `/transfers/submit` verifies the card signature and re-simulates with `authMode: enforce`, exercising the account's real `__check_auth` and verifier. Channels submits the preserved host function and signed auth while paying the outer envelope fees. The relay and deployment key gain no signing authority over the account.
5. `/transfers/status` resolves the relay receipt and independently checks the confirmed envelope through RPC. The UI refreshes balances after confirmation.

### Configuration and recovery

Set `ALLOW_TRANSFERS=true` on the backend and configure `CHANNELS_API_KEY`. `MAX_TRANSFER_RESOURCE_FEE` defaults to 10,000,000 stroops as the simulation resource-fee ceiling; it is not an absolute bound on the relay's final inclusion fee. Host the backend over HTTPS for a phone outside local development.

The backend uses Node's built-in SQLite support (Node 22.18+; tested on 24.11.1). Run one service process with `backend/data/transfers.sqlite` on a persistent disk, or set an absolute `TRANSFER_DB_PATH`. Keep and back up this database: it records submission intent before calling the relay. Do not use an ephemeral filesystem for a deployed service. The workspace's root dependencies are required because the backend imports the same TypeScript codec as the phone.

The phone saves the transfer ID, approved intent and signature in SecureStore before submission. Reopening Send tokens restores the receipt; Check payment status retries only a previously saved signature if the server has not submitted it. Concurrent or repeated submissions do not create a fresh authorization. A pending/uncertain transfer blocks new submissions for that account. Confirmed, rejected, or never-submitted expired transfers allow a new payment.

A relay timeout without a recoverable transaction ID/hash stays **unknown**, even after the authorization expires. Expiry does not prove the payment never landed. The UI intentionally does not offer a replacement payment in this state. An operator must reconcile the authorization nonce/invocation with the relay and ledger before resolving that database record. Records whose hashes have fallen outside RPC retention likewise require reconciliation. No automated discard or automatic re-signing is performed.

### Validation

- Five TypeScript codec regressions cover exact amounts, changed intent, account/network/verifier substitution, nested invocations, expiration, nonce binding, low-S and direct-hash signatures.
- Backend tests cover SDK 16/17 XDR interoperability, signature rejection, concurrent submissions, enforcing simulation failure, expiry and durable recovery after a lost relay response.
- The phone codec's checked-in V1/V2 XDR vectors execute through OpenZeppelin v0.8 `do_check_auth` and the actual P-256 verifier in the local Soroban host. The test token moves balances; changed amounts/recipients, expired approval and replay fail. The original transfer qualification had 21 passing Rust tests; the backup-card extension adds an independent-authority host test.
- The attached physical card (UID suffix `8fb4`) signed the new OpenZeppelin authorization digest. Its deployed mainnet account passed an **enforcing** RPC simulation of an XLM transfer in ledger **65172103**. This probe used a zero amount because the account is unfunded; production amount validation rejects zero. No transaction was submitted and no funds moved.
- Android production JavaScript/Hermes export, lint and TypeScript checks pass. The phone was disconnected during this implementation. An on-device UI test and a funded, nonzero on-chain transfer remain to be qualified.

## Personal wallet and card management

The app opens a saved wallet without requiring a new card scan. The wallet registry stores public P-256 keys, their deterministic mainnet C-addresses, card UIDs, user-defined names and the most recently verified card snapshot. Each account is keyed by its C-address; several cards and several verified keychains per card can coexist. Old one-key-per-card SecureStore installations are migrated without exposing or replacing pairing keys.

Home, Activity, Cards and Settings provide:

- XLM, Circle USDC and EURC balances, refresh, balance privacy and account selection.
- Send with saved contacts, exact amount review, a private local note and fresh P-256 card approval. The reader checks both physical UID and the selected account's public key **before signing**.
- Account-address QR/copy/share and `vaultpass://pay` request QR/copy/share. Requests include explicit mainnet, asset and exact amount. They are VaultPass links, not claims of generic SEP-7 compatibility for C-addresses; unsupported fields and networks are rejected. Opening a request never submits a payment.
- Account-scoped outgoing receipts and pending-payment recovery, plus read-only incoming/outgoing SAC transfer events. Network history is fetched in 1,024-ledger ranges with pagination and an explicit coverage label. Public RPC retention is limited; this is not a lifetime statement or an archival indexer. Older receipts remain on the originating phone.
- Card selection, nickname, verified keychain/account association, firmware and public-key details; re-pair and forget this phone's pairing key. Forgetting pairing preserves watch-only accounts and receipts.
- Optional OS authentication on opening the app, returning from background and manual lock. Pairing credentials and pending signatures remain in SecureStore; names, contacts and history use AsyncStorage. There is no cloud backup. New personal-wallet copy is currently English; existing scan/payment translations remain available.

### Capability boundaries

The app consumes issuer-configured cards using the published ITEM SDK `0.7.0-exchange.3`. Cardholder PIN authentication, owned-master account derivation, explicit ring selection for signing, and bank URI configuration use existing SDK methods. Account creation discovers a P-256 signing engine and uses a fresh random derivation path; no firmware is changed or installed. UID and public-key checks bind approvals to the selected card/account. Older firmware with unreliable addressed-ring routing needs separate qualification.

The bank workspace includes the public default factory pairing key at the user's request. Its use is explicit and separate from cardholder PIN login; a failed PIN never triggers pairing fallback. The default PIN is six characters; personal PINs support 6–12 characters. PINs are never persisted. The first connection uses the public access profile supplied with the configured card, which is cached only after successful verification.

Initial PIN policy, issuer/cardholder ownership enforcement, master issuance, and independent NDEF keychain-selection permissions belong to the supplied card configuration and firmware team's interface. This branch does not invent APDUs or implement these policies in firmware. The current SDK has no qualified NDEF keychain-selection method, so the app does not offer that operation.

The initial OpenZeppelin deployment has zero policies and one card. The backup flow below adds independent card authority. The new cardholder-controlled freeze policy is implemented and tested locally but awaits deployment and enablement. Every card rule must carry that policy before account-wide freeze is reported. Daily limits remain outside this change. Losing every authorized card has no automatic recovery. See [implementation and rollout](cardholder-release.md).

### Build and release automation

`.github/workflows/ci.yml` runs on branches and pull requests: formatting, ESLint, TypeScript, wallet/crypto/release tests, backend tests, Rust contract tests, Android Hermes export and a native Android build. Ordinary CI APKs use the generated debug certificate and an inert `https://ci.invalid` service URL. A manual run with `connect_backend` enabled builds a preview using the configured HTTPS service after checking its health. Both are debug-signed and are never the release artifact. See [EC2 deployment](backend-deployment.md) for the hosted service and operating instructions.

`.github/workflows/release.yml` handles tags matching exactly `vX.X.X`. The tag commit must already be on `main`. All CI gates run again, then EAS builds an APK using the `release` profile and remote Android signing credentials. The workflow validates the returned build's commit/version, checks the APK signature, and creates a GitHub Release with generated notes, the APK, SHA-256 checksum and build identity. It refuses to replace an existing release or publish a debug-signed APK. It does not tag, deploy the backend, submit a store listing or transact on mainnet.

One-time setup in the GitHub `production` environment (or repository-level settings):

1. `EXPO_TOKEN` Actions secret: an Expo access token authorized for the EAS project in `app.json`. Never put it in an `EXPO_PUBLIC_` value.
2. `VAULTPASS_API_URL` Actions variable: the hosted HTTPS service URL, with persistent storage for its transfer journal. A local Mac address is not suitable for a public release.
3. Initialize and verify the EAS project's **remote** Android signing credentials before the first non-interactive release: `pnpm dlx eas-cli@latest credentials --platform android`. Retain the existing application's signing key if releases must upgrade an already-installed production app. The old local-credentials preview profile is unchanged.

After merging, create and push a release tag, for example `git tag v2.1.0` followed by `git push origin v2.1.0`. No release tag is created by this implementation. CI derives Android versionCode monotonically as `major * 1,000,000 + minor * 1,000 + patch + 1` (minor and patch <= 999) and stamps both Expo and package versions from the tag. API URL and version values are applied only to the build checkout.

## Add a backup card

Implemented locally on 29 October 2026; physical two-card and mainnet enrollment qualification remain outstanding.

Open **Your accounts → Add backup card**. Tap the backup card first to prove possession of its active P-256 key, review the account and exact candidate key, then tap the currently selected authorized card to approve. Authentication uses each card's own PIN or pairing credentials. Neither card exports a private key. This grants full spending and account administration authority to the backup; it is not a limited recovery role or a key clone.

OpenZeppelin 0.8 requires **all signers within a policy-free rule**. Accordingly, VaultPass calls `add_context_rule(Default, "Backup card", None, [External(verifier, backupKey)], {})`, preserving the original rule. It never appends a second signer to the original rule. Each payment selects and commits to exactly one rule ID in the OpenZeppelin digest. Either authorized card can sign independently.

The mobile codec reconstructs the entire enrollment invocation and rejects candidate/account substitution, nested calls, wrong network/verifier, mismatched rule and expired authorization. The current card's signature is saved before relay submission. `/backups/prepare`, `/backups/submit` and `/backups/status` use the same durable claim-before-submit state machine as payments, with a separate account-scoped journal and no automatic re-signing or unknown-outcome replay. The backend requires a fresh, account-bound proof from the candidate before preparation, enforces the current card's real signature by simulation, and confirms the exact transaction envelope and resulting on-chain membership.

The wallet retains multiple card bindings for one address. **Your accounts** selects which card approves payments; balances and history use the original account address. Login discovers indexed accounts for either card and checks on-chain membership. Existing independent accounts on a backup card are retained. Single-card wallet data and rule-zero approvals remain compatible.

The supported authority profile is 1–15 contiguous Default rules, each with one unique P-256 external signer, no expiry and no policies, on the pinned account WASM. Other authority layouts fail closed. Backup removal, threshold recovery and lost-all-cards recovery are not part of this change. The app currently signs with the selected card's active keychain and rejects a changed key.

Validation: TypeScript codec/wallet regressions, backend possession-proof, idempotency, persistence/discovery and authority tests, plus a Soroban host test using the phone's checked-in enrollment and backup-payment XDR. The host test requires original-card authorization to enroll, accepts independent payments from both cards, and rejects replay. No physical-card mutation or mainnet transaction was performed for these tests. CI's existing test and Android export jobs include these additions.

### Existing-stack integration check

The backend builds enrollment arguments from the project's installed `smart-account-kit-bindings` contract specification. The phone reconstructs the invocation independently. A regression test requires byte-for-byte agreement between the backend's OpenZeppelin/SDK 16 encoding and the phone's SDK 17 codec. HTTP integration coverage exercises the existing challenge endpoint, candidate proof validation, current-card approval, idempotent submission, status and confirmed membership.

A read-only probe against the existing mainnet account `CC3UPPKXI343D47WXOHQVKMJYX5JWCLJUCO4XNA3XGJWETZSVRIB46J5` passed in ledger **65203447** on 29 October 2026. Both deployed code hashes matched; the account had one original card rule; OpenZeppelin enrollment simulated successfully in authorization-recording mode. This validates deployment/API compatibility, not a real second card's authorization. No transaction was signed or submitted.

Re-run without card or sponsorship credentials:

```sh
pnpm --dir backend check:backup-integration <mainnet-C-address>
```

The production path continues to use ITEM's portable `ItemSecureTunnel` and `MicrokernelClient.keyrings` for authentication, public-key export and signing, the existing VaultPass HTTP service for proof/receipt handling, and OpenZeppelin Channels for sponsorship. It requires no replacement account contract, additional card firmware commands or backend-held card signing key.
