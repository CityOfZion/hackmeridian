# Cardholder wallet implementation and release status

Implementation branch: `codex/cardholder-wallet`.

## Included

- PIN access and journaled PIN changes for issuer-configured cards. Default PIN length is six characters; personal PINs support 6–12 characters. No PIN is stored.
- Explicit bank factory-pairing mode with the public default pairing key bundled as requested; separate issuer-PIN mode. Retired pairing stays unavailable and failed cardholder PINs never fall back to pairing.
- Bank issuance through the published SDK: create an unprivileged cardholder identity, enroll initial PIN `000000`, generate masters on-card, transfer private master ownership, and verify cardholder access. Public activation details support handoff to another phone. Activation verifies a personal PIN before removing the default.
- Account creation under an owned master through published SDK derivation, account/keychain selection, and balances.
- Existing SDK bank NDEF URI configuration. Independent NDEF keychain selection awaits the firmware team's supported SDK interface.
- Backup-card enrollment with possession proof and existing-card approval. The backup becomes an independent OpenZeppelin account rule.
- Account-wide, cardholder-controlled on-chain freeze. Any authorized card, including a backup, can unfreeze it.
- Persistent backend journals and recovery for payments, backup enrollment, and freeze changes.
- CI checks, contract tests, Android builds and existing semver-tag signed APK releases.

## Scope correction

The user supplies cards with firmware, engines and an issuer login configured. The bank now creates the cardholder identity and account master through existing SDK APIs. Firmware implementation, factory installation and firmware-enforced initial-PIN policy are outside this branch. The app guides PIN activation and blocks account creation while its activation receipt is pending; this local gate is not enforcement against another app or a cleared installation. Experimental firmware patches and their custom app protocol adapter were removed from VaultPass. No existing firmware working repository or physical card was modified. Those isolated temporary prototypes are not release inputs.

The app uses the existing SDK only. First-time PIN login requires the public identity/credential-slot profile supplied with the card; the verified profile is cached. Newly derived paths use 124 random bits under `44'/148'` so creating an account from another phone does not reuse a local counter. Account names remain local wallet labels.

## Bank issuance and activation

Open **Manage card → Bank issuance & settings**, identify the card and select the configured issuer authentication. The inspected card has retired factory pairing, so use **Issuer PIN**, identity 1 / credential identity 1 / slot 0. The app never falls back from a rejected PIN to factory pairing.

1. Enter an unused cardholder identity number (default suggestion 2), review the card and recipient, then prepare the card. Preflight checks issuer create-master/identity-management capabilities, P-256 availability, unused recipient and master capacity.
2. The SDK creates an individual identity with capabilities **0**, ANY_OF / threshold 1; it enrolls the public initial PIN `000000` with five attempts. Owning a master permits derivation; standalone key creation and bank administration capabilities are not granted.
3. The SDK generates the master seed on the card. No import/export of private material occurs. On an empty card the first generated master is automatically the firmware's tunnel anchor, so setup reserves that master under the issuer and generates a separate account master. Two free master slots are required for that case, otherwise one.
4. Review and explicitly transfer the account master to the new identity. Owner-only mode `0700` is required before transfer, and owner/group metadata is checked afterwards. Account derivation later creates cardholder-owned keyrings under that master.
5. For another phone, copy the public activation details after transfer. On the cardholder phone identify the card, open **My accounts**, and load those details. The record contains card/identity/master/credential-slot identifiers and progress only; it is not authentication. A fresh cardholder PIN session must prove ownership on the same card.
6. Verify the initial PIN, enroll a different personal PIN, verify that PIN in a new session, and then remove the initial credential. Only then does this installation enable account creation. The new PIN and seed are never saved in the receipt. The normal wallet credential cache is populated after opening the first account with a verified signature.

Before each state-changing command, SecureStore records its pending stage. After a lost identity/generation/ownership acknowledgement, **Inspect issuance** reads card state and only resumes a uniquely identifiable outcome. It does not repeat generation. Unknown PIN enrollment/removal requires supported credential inspection rather than a blind retry. A malformed or missing-readable receipt fails closed; uninstalling/clearing app storage is not a recovery procedure. Issuance is serialized with other card actions.

**Authority boundary:** the new cardholder has no global bank capabilities, but an issuer retaining `MANAGE_IDENTITIES` can administer other identities/credentials under the current firmware policy. Owner-only master transfer removes direct master access from the issuer identity; it does not establish exclusive cardholder control or revoke credential-administration authority. The app exposes this limitation and does not silently modify issuer capabilities, install firmware, or claim noncustodial separation from metadata alone. Bank URI configuration remains a separate issuer operation.

Validation for this addition uses the installed `0.7.0-exchange.3` SDK against a stateful APDU fixture. Issuance and default-PIN cardholder operation were subsequently qualified on the desktop reader as detailed below. Personal-PIN activation and phone NFC remain to be qualified. No physical card was mutated during code implementation; only the later user-authorized qualification provisioned the test card.

## Desktop card qualification — 2026-10-29

Using the app's installed SDK and the exact `startIssuance`, `advanceIssuance`, `verifyIssuance`, `deriveAccount` and signature-verification functions, the current PC/SC card (application UID ending `1716f8b3`) passed:

- Issuer identity 1 PIN authentication; recipient identity 2 initially absent; no masters or keyrings present.
- New identity 2 with capabilities `0`, ANY_OF / threshold 1 and one password credential in slot 0. Initial PIN enrollment and a separate cardholder login succeeded.
- On-card generation of reserved tunnel master slot 0 (issuer-owned) and account master slot 1; ownership transfer of slot 1 to identity 2, group 255, mode `0700`.
- Fresh cardholder ownership verification through the app's issuance function.
- At the user's explicit request, the initial PIN was retained for this qualification. One account keyring (slot 0, discovered P-256 engine slot 0) was derived under master slot 1. Its owner is identity 2 and its mode is `0700`.
- A disposable local challenge produced a 65-byte public key and 64-byte signature in **447 ms**. Strict P-256 verification, the app verifier and low-S normalized P-256 verification all passed. No Stellar authorization or transaction was submitted.
- A new issuer session received `6986` on direct resource reads for both account master slot 1 and keyring slot 0. This demonstrates direct resource access separation; it does not remove or test away the issuer's identity-administration capabilities.

The saved issuance stage remains `personal-pin-ready`, not `complete`. Personal-PIN enrollment, initial-PIN removal, phone NFC and multi-keyring routing remain unqualified by this run. The desktop account derivation deliberately exercised the user's requested default-PIN test outside the phone's activation gate. No firmware was changed. Journals were flushed before mutation and no uncertain command was replayed.

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

Validated locally: 49 app/codec/model tests (including 10 bank issuance/activation regressions), 26 backend tests, and 25 contract tests. TypeScript, ESLint, Prettier and Android Hermes export passed. The new policy WASM was compiled and its pinned hash verified.

App/codec tests, backend HTTP/journal tests, and the real OpenZeppelin contract integration tests run locally. TypeScript, ESLint, Prettier and the Android Hermes export are required gates. The freeze WASM builds with the pinned hash above. Contract tests prove primary-card freeze, payment rejection from both cards, backup-card unfreeze, replay rejection, and subsequent backup payment.

Remaining physical qualification includes personal-PIN rotation, phone NFC, multi-keyring routing and bank URI configuration. Production deployment of the new backend/contract features remains pending. No new firmware changes or firmware artifacts are part of this branch.

### Foreground NFC and initial access defaults (2026-10-29)

- Android reader mode now belongs to the app process, with `SKIP_NDEF_CHECK` retained across card exchanges and PIN dialogs. The native NFC manager suspends the reader when the Activity pauses and restores it on resume. Idle detection performs no authentication or card mutation.
- Explicit card operations first connect to an already-present tag, then wait for a new tap if the cached tag is stale. Cancelling an exchange leaves foreground NDEF suppression registered. PIN attempts are never automatically retried.
- Bank access starts in Issuer PIN mode: identity 1, credential identity 1, slot 0, public initial PIN `000000`. First-use cardholder access suggests identity 2, credential identity 2, slot 0, initial PIN `000000`. Unbound profiles and PINs remain editable. Saved profiles take precedence; personal-PIN entry and new-PIN selection are blank.
- Validation: 53 tests passed, including foreground registration reuse, held/stale tags, cancellation, disabled-NFC recovery and PIN-default separation. Lint, TypeScript and formatting checks passed. No Android device was connected for physical NDEF/focus qualification; this remains a device acceptance check.

### Guided cardholder setup (2026-10-29)

The cardholder workspace now has four steps: connect the card, finish personal-PIN setup, review/select an owned masterkey, then choose or create an account keyring. New-account creation has a name/review/tap sequence followed by an explicit “Open account” action that verifies the card signature, resolves the Soroban account and reloads its balances. Existing accounts keep their stored names. Changing masterkey clears the previous keyring selection.

Activation still uses the bank’s public activation details or the receipt from issuance on this phone. Existing personal-PIN users can proceed to authenticated masterkey inspection when there is no pending activation receipt. Pending or unreadable activation cannot be skipped. PIN enrollment, verification and removal remain separate deliberate taps with saved progress and contextual prompts; personal PINs are not prefilled. Interrupted mutations still require inspection before another creation.

The bank workflow, permissions, SDK operations and NDEF settings are unchanged. Its shared issuance component reports progress to the new cardholder presentation. Smart-account balances, payments, backup cards, freezes, contacts, account switching and the existing bunq code/routes are unchanged. The older bunq funding flow remains separate from the Soroban dashboard; this change does not integrate it.

Validation: 57 tests passed, plus lint, TypeScript and formatting checks. New regression cases cover setup progression, activation gating, existing personal-PIN entry and keyring/master selection. Physical phone/card acceptance testing remains outstanding; no card or mainnet mutation was performed for this UI change.

### Single-operation PIN setup and interrupted-scan recovery (2026-10-29)

This supersedes the separate cardholder PIN screens above. Cardholders enter the current/initial PIN, new PIN and confirmation in one form. One explicit action checks ownership (during activation), enrolls the new PIN, authenticates it in a fresh tunnel, and removes the old PIN. A resumed acknowledged enrollment asks only for the already-chosen new PIN; it never enrolls again. The bank workflow is unchanged.

Verified cardholder PINs are cached only in foreground memory, scoped to card UID and the exact access profile. The cache expires after 15 minutes and clears on background/inactive, wallet lock, forgetting access or a failed card operation. A generation guard prevents an in-flight operation from restoring the cache after a lock/background event. No PIN is stored in Redux, navigation, persistent storage, receipts or logs. Each account/payment action still requires its explicit button/tap; cached access does not authorize background payments.

Interrupted PIN enrollment/removal now offers Recover. Read-only password-exchange PARAMS reads enumerate public credential slots (no BEGIN/CONFIRM or attempt-consuming login during inventory). The cardholder then authenticates; the authenticated identity and credential count must match the inventory before a receipt is reconciled. A discovered new credential still needs successful authentication with the user's chosen PIN before old-PIN removal. Missing-record statuses alone mean absent; unsupported, locked or transport failures are not treated as empty slots. Ambiguous inventories remain blocked. The same recovery is available for changing an existing wallet PIN. An already blocked credential still requires issuer recovery.

Account creation journals now include the original masterkey's complete keyring inventory and intended name. After a failed scan, a fresh read can find one new account keyring or establish that no keyring was added. The user explicitly continues using the found account or returns to creation. Older receipts can recover one newly found account; they cannot automatically establish an unchanged full inventory. No write is blindly replayed.

Validation: 67 tests passed, plus lint, TypeScript and formatting. Failure-injection tests cover enrollment/removal acknowledgement loss, failure before writes, failed new-PIN authentication, cancellation, mismatched inventory, cache/profile isolation, cache expiry and revocation, and current/older account-recovery receipts. Physical phone/card acceptance testing remains outstanding. No firmware, physical card or mainnet changes were made in this task.

### Live recovery correction (2026-10-29)

The connected Android phone reproduced a recovery failure before PIN entry: password PARAMS returned `6982` for the old credential slot. Public slot inspection now collects successful responses while treating `6982` as concealed state, never as proof that a credential is absent. Reconciliation still requires fresh holder authentication and an exact match between the authenticated credential count and the observed slots. A concealed existing credential therefore blocks recovery rather than being mistaken for a deleted PIN. Transport and unsupported-operation failures still stop inspection.

Physical verification on the connected Samsung and supplied card: slot 1 returned password parameters; slots 0, 2 and 3 returned `6982`. One user-supplied personal-PIN authentication succeeded, authenticated reconciliation confirmed that only the personal credential remained, and the app advanced from interrupted setup to masterkey review. The next read used the cached PIN without a prompt and displayed masterkey 2, owned by identity 2, with no existing keyrings. Recovery did not enroll or remove a credential. No firmware or mainnet changes were performed.

Validation: 68 app tests passed, including a new regression covering concealed slots, successful authenticated recovery, and rejection when a concealed credential still contributes to the authenticated count. Lint, TypeScript, formatting and diff checks passed. The fix is loaded in the phone's development build through Metro.

### Bank/user entry and scan-driven routing (2026-10-30)

Normal launch now opens a welcome screen with “I'm a bank” and “I'm a user”. Bank entry opens Configure Card and Edit Card as distinct routes. Configure Card retains identity/PIN provisioning, masterkey creation, ownership transfer, handoff and issuance recovery. Edit Card exposes the verification URL (default `https://coz.io`), authenticated card inspection and an expandable issuance/recovery section. Selecting the bank role grants no card permissions; every operation still authenticates through the existing SDK. Existing payment deep links remain registered.

User entry identifies the physical card before selecting a workflow. Pending issuance, PIN-change and account-mutation receipts take precedence over remembered wallet accounts. Completed cards are authenticated, their owned masterkeys/account keys are inspected, and a matching remembered account (or the sole account) is opened through the existing verified challenge and Soroban resolution flow. Multiple accounts without a remembered match require selection. Changed public keys block automatic opening. Failed wallet resolution retains the existing card/account selection for an explicit retry instead of repeating account creation.

On a new phone, the standard bank profile (cardholder identity 2) can be discovered using public password parameters. Those observations only select a PIN profile; authenticated identity, capabilities, credential count, owned masterkeys and engine availability establish the next step. Standard initial-PIN handoffs can be reconstructed locally after authenticated ownership checks, without generating a card key or overwriting an existing receipt. Unknown/ambiguous profiles and nonstandard handoffs retain the bank activation-details route. No PIN is guessed or automatically retried. Leaving the scan screen cancels active NFC work.

After PIN activation, user onboarding reads the masterkeys once using the session cache. A single account source is selected automatically; account naming/review/creation, multiple-master selection and interrupted-write recovery remain available. Existing wallet balances, payments, history, contacts, backups, freeze/unfreeze, card security and account management remain connected. Settings offers Switch role, clearing the in-memory PIN cache. User and issuer workflows no longer share a role toggle inside the card screen.

Validation: 75 app tests passed, including six new routing/ownership regressions. ESLint, TypeScript and formatting passed. The Android release build includes the production relay configuration. No phone was connected for physical NFC acceptance of these new routes; no card, firmware or mainnet mutation was performed during implementation.
