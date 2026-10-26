@AGENTS.md

## App

Stellar Vault Pass (spec: "Stellar Vault Pass — Technical Specification", Oct 2026): an ITEM NFI (the Aeroglyph "Pass") is the user's identity and key for a USDC Spend Vault on Stellar. The spec targets a PWA, but browsers can't send APDUs to the chip (Web NFC is NDEF-only), so this is a native app. One flow:

1. **Scan** (`(screens)/scan`): tap the Pass (first use: enter its application pairing key), the chip signs a fresh challenge, then Face ID. The verified chip UID is the session; it opens the dashboard. Dev builds also offer "Simulate scan".
2. **Dashboard** (`(screens)/vault/dashboard`): vault balance (the Pass's on-chain USDC, with its XLM in small text below) and its Stellar address with a copy button, the bunq virtual cards (one Pass, many cards) as a stack, sign out, and a pinned Fund button for the selected card. Tap the stack to expand it, tap a card to select it.
   - **New card** (`(screens)/cards/create`): name + card face → bunq virtual card; it starts with nothing loaded.
   - **Fund** (`(screens)/vault/fund`, `{ cardId }`): amount, capped by the vault balance → **Confirm** (`(screens)/vault/confirm`): the same Pass signs a USDC payment on Stellar (mainnet by default), then Face ID (the spec's two factors for anything that moves money). Once the payment is successful in a closed ledger, the vault balance is refetched from the chain and the card's bunq limit rises by the amount → **Result** (shows the transaction hash).

There is no backend. Cards come from bunq production, called straight from the app (see bunq). The vault is the Pass's own Stellar account: its balance is the account's USDC, read from Horizon (`store/api/vault-api.ts`), until the Soroban Spend Vault exists. The chip signs for real: sign-in is a local proof of possession (see Pass signing), and each funding is a Stellar payment signed by the card (see Stellar). Face ID / fingerprint (`expo-local-authentication`, `hooks/use-biometric-confirm.ts`) stands in for the spec's passkey; development builds without biometric hardware skip it.

## Project layout

```
index.ts                       registerRootComponent → src/app
metro.config.js                Uniwind Metro wrapper (keep it outermost)
assets/card/                   card face SVGs (rendered with expo-image)
src/
  app.tsx                      fonts (Outfit), Redux Provider, SafeAreaProvider, <NavigationRoot />
  global.css                   Tailwind v4 + Uniwind entry, @theme colors and font families
  theme/colors.ts              same colors for places className can't reach (SVG, navigator options)
  constants.ts                 asset code, limits, dev chip ID
  api/
    types.ts                   Card, CardDesign, ApiError
    item/                      Pass signing: card-crypto (pure: pairing key parse, challenge, signature verify),
                               card-signing (SecureStore credential, challenge digest via expo-crypto)
    bunq/                      bunq production client: client (headers, Response unwrap), rsa (react-native-quick-crypto),
                               session (installation → device → session, cached in SecureStore), cards
    stellar/                   config (network, USDC, receiver), horizon (submit + wait for ledger, balances),
                               payment, account (Pass address + USDC balance)
  routes/                      folder layout copied from neonhq (apps/mobile/src/routes)
    navigator.tsx              NavigationRoot: createStaticNavigation(stack), theme, deep linking
    stack.tsx                  root native stack: `screens` and `drawers` groups, RootNavigator augmentation
    screens/                   route '(screens)/<path>' lives in screens/<path>/
      scan/                    opens a session by tap (first screen)
      cards/create/
      vault/{dashboard,fund,confirm,result}/
    drawers/                   route '(drawers)/<path>' lives in drawers/<path>/
      session/sign-out/
      pass/pairing-key/        first tap of a Pass: pairing key input, then sign-in
  layouts/screen-layout.tsx    ScreenLayout compound component used by every screen
  layouts/sheet-layout.tsx     SheetLayout: bottom sheet for drawers (dark panel, brass border, like the tap modal)
  components/
    ui/                        app-text (AppText/Eyebrow), button, icon, money, ...
    card/                      physical-card (card visual), card-design-picker, diagonal-bands
    nfc/                       nfc-rings (waiting-for-tap animation)
  hooks/
    use-item-nfi.ts            ITEM NFI tap over NFC: tunnel, sign, verify (useScanItemNfi)
    use-pass-tap.ts            signed tap → chip UID (tapPass), sign a digest (signWithPass), simulate
    use-biometric-confirm.ts   Face ID / fingerprint, the passkey stand-in (expo-local-authentication)
    use-session.ts             useRequiredChipId (redirects to scan without a scanned Pass)
    use-sign-in.ts             after a verified tap: Face ID, session, reset to dashboard (scan + pairing drawer)
  store/
    index.ts                   configureStore + combineSlices, RootState / AppDispatch
    api/cards-api.ts           RTK Query API over the bunq client (getCards, createCard, fundCard)
    api/vault-api.ts           RTK Query API over Horizon (getVault: Pass address + USDC balance, tag 'Vault')
    api/call.ts                shared queryFn wrapper (logs failures in dev)
    slices/session-slice.ts    scanned chip ID
    slices/pass-tap-slice.ts   Pass tap in progress (title, step, result) for the tap modal
  utils/                       cn (tailwind-merge), formatting, randomHex
tests/card-crypto.test.mjs     node --test for api/item/card-crypto (pnpm test:card)
docs/item-card-signing.md      signing design and physical card qualification notes
```

## Conventions

- **Naming**: every file and folder is kebab-case (`spend-limit/`, `app-text.tsx`, `use-current-holder.ts`, `holders-slice.ts`). Exported identifiers keep normal TS casing (`BankCardsDetailsScreen`, `useCurrentHolder`).
- **Routes** follow neonhq: the route name is the folder path inside `routes/`, with the group in parentheses: `'(screens)/vault/confirm'` is `routes/screens/vault/confirm/index.tsx`, `'(drawers)/session/sign-out'` is `routes/drawers/session/sign-out/index.tsx`. Nested navigator routes, if added, are PascalCase and end in `Stack`.
- **Screens and drawers**: the component is the named export in `index.tsx`, named after the path (`VaultConfirmScreen`, `SessionSignOutDrawer`). Route params go in `types.ts` beside it (`TVaultConfirmScreenParams`), used as `StaticScreenProps<TVaultConfirmScreenParams>`. Helpers used only by that route live in the same folder with a `-` prefix (`vault/fund/-keypad.tsx`, `scan/-use-title-entrance.ts`).
- **Imports**: use the `@/` alias (`@/components/ui/button`, `tsconfig.json` paths) for anything outside the current folder; `./` only for siblings, grouped after the `@/` imports.
- Always render text through `AppText` (or `Eyebrow`). RN text doesn't inherit fonts, so raw `<Text>` falls back to the system font.
- **No fixed pixels in classNames.** Tailwind v4's spacing scale is dynamic (`--spacing` = 0.25rem), so write `px-5.5`, `size-20.5`, `max-w-100`, not `px-[22px]`. Font sizes come from the type scale (`text-4xs`/`3xs`/`2xs` are custom tokens in `global.css` and `xs`/`sm`/`base` are raised there: 12/13/14/15/16/17 px; `lg`…`6xl` are Tailwind's); letter-spacing uses `tracking-tight|tighter|widest` (em-based); line-height uses `leading-none|tight|normal|relaxed`; radii use `rounded-lg|3xl|full`. Safe areas use Uniwind's `pt-safe`, `pt-safe-offset-3`, ... (fed by `SafeAreaListener` in `app.tsx`; apply them to Views, not `contentContainerClassName`). Third-party components that only take `style` get `className` via `withUniwind(...)`. Inline `style` is only for animated or computed values (e.g. a progress `%`).
- Font weight is a font family: use `font-outfit`, `font-outfit-medium` or `font-outfit-semibold` (the only weights loaded), never `font-bold`.
- Use `cn()` to merge an overridable `className` prop.
- Navigate with typed route names: `navigation.navigate('(screens)/vault/confirm', { amount })`. After sign-in or sign-out, `navigation.reset(...)` so back can't return across the session boundary.
- Every screen is built from `ScreenLayout` parts; navigator headers are off:
  ```tsx
  <ScreenLayout>                        {/* className to change the background */}
    <ScreenLayout.Header>               {/* fixed; owns the top safe-area inset */}
      <ScreenLayout.Heading>
        <ScreenLayout.Eyebrow>SPEND VAULT</ScreenLayout.Eyebrow>
        <ScreenLayout.Title>Fund card</ScreenLayout.Title>
      </ScreenLayout.Heading>
      <ScreenLayout.BackButton />       {/* optional; goBack() unless onPress */}
    </ScreenLayout.Header>
    <ScreenLayout.Body>…</ScreenLayout.Body>       {/* ScrollView with page gutters; takes ScrollView props */}
    <ScreenLayout.Footer>…</ScreenLayout.Footer>   {/* optional pinned primary actions; owns the bottom safe-area inset */}
  </ScreenLayout>
  ```
  Put the primary CTA in `Footer`, except on screens with text inputs (the keyboard would cover it). A screen without `Header` (scan) must handle the top inset in `Body`; a screen without `Footer` (scan, cards/create) must keep its last content clear of the bottom inset (`pb-safe` on a View).
- Confirmation dialogs are drawers: `src/routes/drawers/<domain>/<name>/index.tsx` (named export `XDrawer`), registered in the root `drawers` group (`transparentModal`) and built on `<SheetLayout>` (`@/layouts/sheet-layout`).

## Deep links (dev)

Every screen sets `linking` in `stack.tsx` to its route name without the group, so `'(screens)/vault/confirm'` opens at `vault/confirm`. Screens behind the scan send you back to scan without a scanned Pass (use "Simulate scan" first; dev builds only). With the development build installed:

```
xcrun simctl openurl booted "vaultpass://vault/dashboard"
xcrun simctl openurl booted "vaultpass://cards/create"
xcrun simctl openurl booted "vaultpass://session/sign-out"
```

Numeric params need a `parse` entry in the screen's `linking` config (see vault/confirm). Errors from bunq and the cards API print to the Metro terminal in development (`[bunq] …`, `[api] …`).

## bunq

Cards are bunq virtual Mastercards (spec "bunq integration detail"), always on bunq production (`https://api.bunq.com/v1`): cards and limits are real money. The spec keeps bunq credentials on the COZ backend; until it exists, `src/api/bunq/` does the API context on the device. EXPO_PUBLIC_ values are bundled in plain text, so anyone with a build can read the API key.

- Config: `EXPO_PUBLIC_BUNQ_API_KEY` (required, a production key from the bunq app) in `.env.local` or `.env` (both git-ignored; copy `.env.example`). Values are inlined at bundle time: restart Metro with `pnpm start --clear` after changing them. Without a key, bunq calls fail with "Set EXPO_PUBLIC_BUNQ_API_KEY…".
- SecureStore keys are prefixed `bunq.production.*`, so installs that used the sandbox never reuse its installation or session.
- First call: a 2048-bit RSA key pair generated natively (`react-native-quick-crypto`, OpenSSL; pure JS took minutes on Hermes), `POST /installation`, `POST /device-server` (`permitted_ips: ['*']`, falling back to IP-bound), then `POST /session-server` signed with `X-Bunq-Client-Signature`. Keys, tokens and the session live in `expo-secure-store`; a 401 reopens the session once.
- Sign-in prefetches `getCards` and `getVault` while Face ID runs (`scan/index.tsx`), so the bunq session is usually open by the time the dashboard mounts.
- `GET /cards` → `GET /user/{id}/card` (ACTIVE and DEACTIVATED cards; others hidden). Label = `second_line` (max 17 chars), last four = `primary_account_numbers[0].four_digit`, loaded balance = `card_limit`.
- `POST /cards` → `POST /user/{id}/card-debit` (`MASTERCARD` / `MASTERCARD_DEBIT`, `VIRTUAL_DELIVERY`, first active IBAN, first allowed `card-name`), then `PUT` status ACTIVE and `card_limit` 0 (new cards come with 1000 EUR). Virtual cards can stay DEACTIVATED (seen in the sandbox), so the app treats DEACTIVATED as usable.
- Funding raises the card's `card_limit` by the amount (`PUT /user/{id}/card/{cardId}`); it runs only after the Stellar payment is confirmed.
- Card faces aren't stored in bunq: the chosen face lasts for the app run, otherwise it's derived from the card ID.
- Every Pass sees the same bunq user's cards; a backend will map cards to Passes.
- bunq never checks the Stellar payment: the app raises the limit itself once the ledger confirms it. Production needs a backend that verifies the payment and binds each card to its bunq account.
- Responses aren't verified against bunq's server signature yet.

## Stellar

Fundings are USDC payments on Stellar from the Pass's own account to `EXPO_PUBLIC_STELLAR_RECEIVER` (see `.env.example`). The Pass's active KeyRing is Ed25519, so its 32-byte public key is a Stellar `G…` account and the card signs the transaction hash directly (Stellar's signature scheme). `src/api/stellar/` uses `@stellar/stellar-sdk/base` (no axios) and plain `fetch` to Horizon.

- Confirm builds the payment first (Horizon sequence, 180 s time bounds, memo `fund card <id>`), then the tap signs `transaction.hash()` via `signWithPass`; NFC stays short. Then Face ID, then submit.
- USDC trustline: the dashboard shows "Add USDC trustline" when the Pass's account exists but can't hold USDC (`-use-add-trustline.ts`: `buildUsdcTrustline` → Pass tap → submit and wait for the ledger → refetch `'Vault'`). Funds don't add it: `buildFundPayment` fails with a message pointing to that button.
- `submitAndConfirm` resolves only when the transaction is successful in a closed ledger (final on Stellar). On a Horizon timeout it polls the hash until `maxTime` passes. Only then is the bunq limit raised. If bunq fails after payment, the screen keeps the hash and a retry only redoes bunq.
- Network: `EXPO_PUBLIC_STELLAR_NETWORK` is `mainnet` (default: real USDC, real money) or `testnet`. The issuer defaults to Circle's USDC on that network (`EXPO_PUBLIC_STELLAR_USDC_ISSUER` overrides it).
- Setup per Pass: its `G…` address needs XLM (reserve + fees; Friendbot on testnet) and a USDC trustline, then USDC. The receiver must exist on the same network with a USDC trustline. Horizon result codes map to messages in `horizon.ts`.
- Funding needs the real Pass: a simulated session can browse but can't sign, so confirm has no "Simulate scan".
- Vault: `loadPassAccount(chipId)` derives the `G…` address from the public key pinned at sign-in and reads its USDC balance (0 when unfunded or without a trustline; the dashboard says which). Confirm invalidates `'Vault'` once the payment is in a ledger. A simulated session has no pinned key, so the dashboard shows an error instead of a balance.

## NFI scan

`hooks/use-item-nfi.ts` talks to an ITEM card with `@item-systems/item/mobile` (the package ships its own agent skill in `node_modules/@item-systems/item/skills/item-sdk-typescript`; read it before touching card code). `react-native-nfc-manager` provides the ISO-DEP `CardTransport`, `expo-crypto` the `RandomSource`. `ItemSecureTunnel.connect()` SELECTs the ITEM kernel and returns `CardInfo` (`uid`, `version`, `paired`); the tap then signs (see Pass signing). It never pairs, provisions or changes card state.

- Android reads in reader mode (`ANDROID_READER_MODE`: NFC-A/B, skip NDEF, 5 s presence-check delay), so the tag comes straight to the app instead of through foreground dispatch (where Wallet or a stale registration could swallow it). Each tap first cancels any leftover request and unregisters the old tag event, and gives up after 30 s ("No Pass detected…").
- Tap UI: every `usePassTap` tap drives `pass-tap-slice` (`tapStarted` → `tapStepChanged` → `tapSucceeded`/`tapFailed`), and `<PassTapModal>` (`components/nfc/pass-tap-modal.tsx`, mounted once in `app.tsx`) shows it on Android: rings, the step's status message (`TAP_STEPS` in `use-item-nfi.ts`), a progress bar, Cancel (`cancelNfiScan`, resolves the tap as null), and a check or error at the end. iOS shows the same messages in its system NFC sheet (`setAlertMessageIOS`). Simulated taps show nothing.
- Every tap logs its steps as `[nfi] +<ms> …` (NFC ready, waiting, Pass detected, each APDU header + SW + time, tunnel, diagnostics, key export, signing, verify, close). They print in all builds: Metro in dev, `adb logcat -s ReactNativeJS` for a release APK. Never log the pairing key, digests or APDU payloads.
- Reading a card needs a phone with NFC running the development build (`pnpm ios --device` / `pnpm android`). iOS only selects AIDs listed in the `react-native-nfc-manager` plugin's `selectIdentifiers` in `app.json`. Android sets a 120 s ISO-DEP timeout: key export and signing are slow, and the link can still fail with `transceive fail`.
- "Simulate scan" exists only in `__DEV__` builds and only on scan (no NFC reader on the iOS simulator and emulators: `isNfiScanAvailable` false). Confirm has none: a funding must be signed by the card. Release builds require a real signed tap. Detection uses `isSupported(NfcTech.IsoDep)` and rechecks when the app becomes active (Android rejects the call before its Activity attaches).

## Pass signing

Every real tap (sign-in and each funding) proves possession of the Pass; details and the physical card test are in `docs/item-card-signing.md`.

- First use: "Tap your Pass" on scan reads the card; only when that Pass has no pairing key saved on this phone (`NfiScanError` code `pairing-key-required`) does it open the `(drawers)/pass/pairing-key` drawer. The user enters the card's 32-byte application pairing key (64 hex chars) there and taps the Pass. After a verified signature, `{pairingKey, publicKey}` is saved in SecureStore under `item.pairing.<uid>` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); later taps use it and the field can stay blank. The in-memory key is zeroed after each tap.
- Tap: `tunnel.open(pairingKey)` → `MicrokernelClient.getDiagnostics()` → `keyrings.exportPublicKey(currentRing)` (must match the pinned key) → `keyrings.sign(currentRing, digest)` → diagnostics again (ring must not change) → verify. Uses only the active KeyRing: firmware v3.5.4 can ignore a requested ring number.
- Sign-in (`tapPass`): the card signs SHA-256 of `JSON.stringify(['VaultPass ITEM proof v1', uid, 'sign-in', '', hex(nonce32)])`.
- Funding (`signWithPass`): the card signs the 32-byte Stellar transaction hash as given; the UID must equal the session's chip ID (see Stellar).
- Verify (`@noble/curves`, `verifyCardSignature`): 64-byte signatures only. A 32-byte public key is Ed25519 (strict, `zip215: false`, signs the digest as the message); 33/65 bytes is P-256 or secp256k1 `ALG_ECDSA_SHA_256` (hashes the digest again, `prehash: true`). The tested card signs Ed25519.
- Fails closed: wrong UID, unpaired card, no KeyRing, changed public key (needs re-enrollment; no reset flow in the app yet), or bad signature.
- Sign-in is a local proof only: that signature never leaves the phone. Funding signatures go on-chain inside the Stellar transaction. Never log, commit or paste a pairing key, and never send it to a backend or treat it as a payment secret.
- `pnpm test:card` runs `tests/card-crypto.test.mjs` with `node --test`; it imports the `.ts` file directly, so it needs a Node with built-in type stripping (22.6+). Keep `card-crypto.ts` free of React Native/Expo imports so it stays testable in Node.

## Adding things

- **Screen**: create `src/routes/screens/<path>/index.tsx` and register it in the `screens` group in `src/routes/stack.tsx` as `'(screens)/<path>'` with a matching `linking` path. Params go in `types.ts`. Screens behind the scan start with `useRequiredChipId()` and render `null` until it returns a chip ID.
- **bunq call**: add the function to `api/bunq/` (wrap it in `withBunqSession`), then an endpoint in `store/api/cards-api.ts` (invalidate `'Cards'` if it changes cards).
- **Drawer**: create `src/routes/drawers/<domain>/<name>/index.tsx` and add `'(drawers)/<domain>/<name>'` to the `drawers` group in `stack.tsx`.
- **Slice**: create `src/store/slices/foo-slice.ts`, add it to `combineSlices(...)` in `src/store/index.ts`. Export actions and `slice.selectors`. Put cross-slice selectors in `store/selectors.ts`.
- **Native dependency**: `pnpm expo install <pkg>`, then rebuild the app (`pnpm ios` / `pnpm android`).

## Before finishing a task

- `pnpm format`, then `pnpm lint` and `pnpm format:check` pass (Markdown is not formatted; `.prettierignore`).
- `pnpm tsc --noEmit` passes. If `className` errors appear, run Metro once (`pnpm start`) to regenerate `src/uniwind-types.d.ts`.
- `pnpm test:card` passes after touching `api/item/`.
- `pnpm dlx expo-doctor` passes after any dependency change.
