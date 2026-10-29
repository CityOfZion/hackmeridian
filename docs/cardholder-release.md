# Cardholder wallet implementation and release status

Implementation branch: `codex/cardholder-wallet`.

## Included

- PIN access and journaled PIN changes for issuer-configured cards. Default PIN length is six characters; personal PINs support 6–12 characters. No PIN is stored.
- Explicit bank factory-pairing mode with the public default pairing key bundled as requested; separate issuer-PIN mode. Retired pairing stays unavailable and failed cardholder PINs never fall back to pairing.
- Account creation under an owned master through published SDK derivation, account/keychain selection, and balances.
- Existing SDK bank NDEF URI configuration. Independent NDEF keychain selection awaits the firmware team's supported SDK interface.
- Backup-card enrollment with possession proof and existing-card approval. The backup becomes an independent OpenZeppelin account rule.
- Account-wide, cardholder-controlled on-chain freeze. Any authorized card, including a backup, can unfreeze it.
- Persistent backend journals and recovery for payments, backup enrollment, and freeze changes.
- CI checks, contract tests, Android builds and existing semver-tag signed APK releases.

## Scope correction

The user will supply configured cards. Firmware implementation, factory provisioning, issuer/cardholder ownership policy and default-PIN activation enforcement are outside this branch. Experimental firmware patches and their custom app protocol adapter were removed from VaultPass. No existing firmware working repository or physical card was modified. Those isolated temporary prototypes are not release inputs.

The app uses the existing SDK only. First-time PIN login requires the public identity/credential-slot profile supplied with the card; the verified profile is cached. Newly derived paths use 124 random bits under `44'/148'` so creating an account from another phone does not reuse a local counter. Account names remain local wallet labels.

## Freeze contract

The new policy is not deployed or enabled by this implementation. The production P-256 verifier and funded accounts are unchanged.

- OpenZeppelin `stellar-accounts = 0.8.0`; Soroban SDK `28.0.0`.
- Build: Rust `1.99.1`, Stellar CLI `28.1.0`, `wasm32v1-none`.
- Command: `stellar contract build --locked --manifest-path contracts/freeze-policy/Cargo.toml`.
- Reviewed WASM SHA-256: `c0e8f4841ecb8cb7253b1e2baecd55236bfe4f4447503c737103f5d0e2c54f76`.
- Deterministic mainnet address: `CAPTKW6GZ7USCDVQMDN6IX3X3AV5WDSJWXSXEXA2QVHVDOCBVHY5EULU`.
- Source: `contracts/freeze-policy/`; deployment guard: `backend/scripts/bootstrap-freeze.mjs`.

The backend pins both address and code hash. `ALLOW_FREEZE=false` is the default. Deployment requires a separately authorized mainnet operation with the server-only Channels key and `BOOTSTRAP_MAINNET_FREEZE=YES`. The script checks the local WASM hash before submission. Enabling the service does not grant the backend spending or unfreeze authority.

Existing accounts require a card-approved policy installation on **every** independent card rule before the app offers Freeze. New accounts created with the feature enabled start protected. A new backup inherits protection whenever any existing rule is protected. Partial migration is displayed as incomplete; unfreeze remains possible during recovery. The policy independently verifies the one-card threshold because OpenZeppelin delegates this check to installed policies.

While frozen, the policy permits only the exact account `execute(policy, set_frozen, [account, false])` operation. Spending and authority changes fail. Missing/expired policy state fails closed; an authorized card must unfreeze/restore it. There is no bank key or upgrade administrator in this policy. Losing every authorized card is not solved by this feature; add a backup before that happens. This new contract has tests, but has not received an independent audit.

## Ordered rollout

1. Receive configured test cards and their public access profiles. Qualify PIN login/change, multiple accounts, requested-ring signing and bank URI changes using the existing SDK. Do not reinstall or reconfigure card firmware.
2. Independently review the freeze WASM and explicitly authorize mainnet deployment. Verify its code hash before enabling `ALLOW_FREEZE`.
3. Deploy the backend with the required feature flags and persistent transfers/backups/freeze SQLite journals. The Channels key stays server-only. The existing backup job snapshots all three journals.
4. Test backup enrollment, policy installation on every card rule, original-card freeze and backup-card unfreeze. Mainnet payments require an authorized amount and recipient.
5. Merge the app after qualification. A stable `vX.X.X` tag runs CI and publishes the signed APK and generated notes, using the configured GitHub/EAS credentials and backend URL.

## Local validation

Validated locally: 39 app/codec/model tests, 26 backend tests, and 25 contract tests. TypeScript, ESLint, Prettier and Android Hermes export passed. The new policy WASM was compiled and its pinned hash verified.

App/codec tests, backend HTTP/journal tests, and the real OpenZeppelin contract integration tests run locally. TypeScript, ESLint, Prettier and the Android Hermes export are required gates. The freeze WASM builds with the pinned hash above. Contract tests prove primary-card freeze, payment rejection from both cards, backup-card unfreeze, replay rejection, and subsequent backup payment.

Physical-card qualification and production deployment remain pending. No new firmware changes or firmware artifacts are part of this branch.
