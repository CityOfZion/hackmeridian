@AGENTS.md

## App

Stellar Vault Pass (spec: "Stellar Vault Pass — Technical Specification", Oct 2026): an ITEM NFI (the Aeroglyph "Pass") is the user's identity and key for an EURC Spend Vault on Stellar. The spec targets a PWA, but browsers can't send APDUs to the chip (Web NFC is NDEF-only), so this is a native app. One flow:

1. **Scan** (`(screens)/scan`): tap the Pass. A known chip → Face ID → session → dashboard. An unknown chip → **Register**.
2. **Register** (`(screens)/register`): name + Face ID enrollment; the backend binds the Pass and deploys the user's vault.
3. **Dashboard** (`(screens)/vault/dashboard`): vault balance, pending withdrawals with countdown, activity, sign out.
   - **Reload**: amount → buy EURC with Mercuryo and `deposit` into the vault.
   - **Withdraw**: amount + destination G-address → `request_withdraw`, executed after the vault's `withdraw_delay`.
   - Both go through **Confirm** (`(screens)/vault/confirm`): a fresh tap of the signed-in Pass plus Face ID (the spec's two factors for anything that moves money), then **Result**.

There is no backend yet: every call goes to an in-memory mock (see Mock API). The chip is read for real; signing is mocked.

## Project layout

```
index.ts                       registerRootComponent → src/app
metro.config.js                Uniwind Metro wrapper (keep it outermost)
assets/card/                   card face SVGs (rendered with expo-image)
src/
  app.tsx                      fonts (Outfit), Redux Provider, SafeAreaProvider, <NavigationRoot />
  global.css                   Tailwind v4 + Uniwind entry, @theme colors and font families
  theme/colors.ts              same colors for places className can't reach (SVG, navigator options)
  constants.ts                 asset code, network, withdraw delay, dev chip IDs
  api/
    types.ts                   TapProof, TapResult, Session, Vault, Activity (backend contract)
    mock-server.ts             in-memory COZ backend: one function per spec endpoint, seeded dev user
  routes/                      folder layout copied from neonhq (apps/mobile/src/routes)
    navigator.tsx              NavigationRoot: createStaticNavigation(stack), theme, deep linking
    stack.tsx                  root native stack: `screens` and `drawers` groups, RootNavigator augmentation
    screens/                   route '(screens)/<path>' lives in screens/<path>/
      scan/                    sign-in by tap (first screen)
      register/
      vault/{dashboard,reload,withdraw,confirm,result}/
    drawers/                   route '(drawers)/<path>' lives in drawers/<path>/
      session/sign-out/
  layouts/screen-layout.tsx    ScreenLayout compound component used by every screen
  components/
    ui/                        app-text (AppText/Eyebrow), button, icon, sheet, money, ...
    card/                      physical-card (Pass visual), diagonal-bands
    nfc/                       nfc-rings (waiting-for-tap animation)
    rows/                      activity-row
  hooks/
    use-item-nfi.ts            ITEM NFI scan over NFC (useScanItemNfi)
    use-pass-tap.ts            scan + POST /auth/tap → single-use tap token (usePassTap)
    use-biometric-confirm.ts   Face ID / fingerprint second factor (expo-local-authentication)
    use-session.ts             useRequiredSession (redirects to scan), useVault (polled vault query)
  store/
    index.ts                   configureStore + combineSlices, RootState / AppDispatch / AppThunk
    api/vault-api.ts           RTK Query API over the mock server
    slices/session-slice.ts    signed-in user (userId, chipId, name)
  utils/                       cn (tailwind-merge), formatting, id generators
```

## Conventions

- **Naming**: every file and folder is kebab-case (`spend-limit/`, `app-text.tsx`, `use-current-holder.ts`, `holders-slice.ts`). Exported identifiers keep normal TS casing (`BankCardsDetailsScreen`, `useCurrentHolder`).
- **Routes** follow neonhq: the route name is the folder path inside `routes/`, with the group in parentheses: `'(screens)/vault/confirm'` is `routes/screens/vault/confirm/index.tsx`, `'(drawers)/session/sign-out'` is `routes/drawers/session/sign-out/index.tsx`. Nested navigator routes, if added, are PascalCase and end in `Stack`.
- **Screens and drawers**: the component is the named export in `index.tsx`, named after the path (`VaultConfirmScreen`, `SessionSignOutDrawer`). Route params go in `types.ts` beside it (`TVaultConfirmScreenParams`), used as `StaticScreenProps<TVaultConfirmScreenParams>`. Helpers used only by that route live in the same folder with a `-` prefix (`vault/reload/-keypad.tsx`, `scan/-use-title-entrance.ts`).
- **Imports**: use the `@/` alias (`@/components/ui/button`, `tsconfig.json` paths) for anything outside the current folder; `./` only for siblings, grouped after the `@/` imports.
- Always render text through `AppText` (or `Eyebrow`). RN text doesn't inherit fonts, so raw `<Text>` falls back to the system font.
- **No fixed pixels in classNames.** Tailwind v4's spacing scale is dynamic (`--spacing` = 0.25rem), so write `px-5.5`, `size-20.5`, `max-w-100`, not `px-[22px]`. Font sizes come from the type scale (`text-4xs`/`3xs`/`2xs` are custom tokens in `global.css`, then Tailwind's `xs`…`6xl`); letter-spacing uses `tracking-tight|tighter|widest` (em-based); line-height uses `leading-none|tight|normal|relaxed`; radii use `rounded-lg|3xl|full`. Safe areas use Uniwind's `pt-safe`, `pt-safe-offset-3`, ... (fed by `SafeAreaListener` in `app.tsx`; apply them to Views, not `contentContainerClassName`). Third-party components that only take `style` get `className` via `withUniwind(...)`. Inline `style` is only for animated or computed values (e.g. a progress `%`).
- Font weight is a font family: use `font-outfit`, `font-outfit-medium`, `font-outfit-semibold` or `font-outfit-bold`, never `font-bold`.
- Use `cn()` to merge an overridable `className` prop.
- Navigate with typed route names: `navigation.navigate('(screens)/vault/confirm', { action: 'reload', amount })`. After sign-in or sign-out, `navigation.reset(...)` so back can't return across the session boundary.
- Every screen is built from `ScreenLayout` parts; navigator headers are off:
  ```tsx
  <ScreenLayout>                        {/* className to change the background */}
    <ScreenLayout.Header>               {/* fixed; owns the top safe-area inset */}
      <ScreenLayout.Heading>
        <ScreenLayout.Eyebrow>SPEND VAULT</ScreenLayout.Eyebrow>
        <ScreenLayout.Title>Withdraw</ScreenLayout.Title>
      </ScreenLayout.Heading>
      <ScreenLayout.BackButton />       {/* optional; goBack() unless onPress */}
    </ScreenLayout.Header>
    <ScreenLayout.Body>…</ScreenLayout.Body>       {/* ScrollView with page gutters; takes ScrollView props */}
    <ScreenLayout.Footer>…</ScreenLayout.Footer>   {/* optional pinned primary actions */}
  </ScreenLayout>
  ```
  Put the primary CTA in `Footer`, except on screens with text inputs (the keyboard would cover it). A screen without `Header` (scan) must handle the top inset in `Body`.
- Confirmation dialogs are drawers: `src/routes/drawers/<domain>/<name>/index.tsx` (named export `XDrawer`), registered in the root `drawers` group (`transparentModal`) and built on `<Sheet>`.

## Deep links (dev)

Every screen sets `linking` in `stack.tsx` to its route name without the group, so `'(screens)/vault/confirm'` opens at `vault/confirm`. Screens behind sign-in send you back to scan without a session (sign in first with "Simulate tap"). With the development build installed:

```
xcrun simctl openurl booted "vaultpass://vault/dashboard"
xcrun simctl openurl booted "vaultpass://vault/confirm?action=reload&amount=20"
xcrun simctl openurl booted "vaultpass://session/sign-out"
```

Numeric params need a `parse` entry in the screen's `linking` config (see vault/confirm).

## Mock API

`store/api/vault-api.ts` is an RTK Query API whose endpoints mirror the spec (`POST /auth/tap`, `/auth/passkey/register|verify`, `GET /vault`, reload = `/buy/session` + Mercuryo webhook + `deposit`, `request_withdraw`). Each `queryFn` calls `api/mock-server.ts`, which keeps state in memory (lost on reload) and throws `Error`s with user-facing messages. To use the real COZ backend, replace `fakeBaseQuery` with `fetchBaseQuery({ baseUrl })` and each `queryFn` with a `query`; screens don't change.

- Taps: `usePassTap` reads the chip ID (ITEM application UID) for real; counter and signature are generated in the app until ITEM Systems publishes the signed-tap format. `POST /auth/tap` returns a single-use `tapToken` that register, verify, reload and withdraw consume.
- Passkey: stood in for by `expo-local-authentication`; skipped in development builds without biometric hardware.
- Signing: transaction hashes are random. Real derive/sign needs the card's pairing key (`tunnel.open`), and the firmware has no Ed25519 (P-256/K1 only), so the vault owner must become a secp256r1 custom account.
- Seed: `DEV_CHIP_IDS.registered` is Maya Chen with 250 EURC; `DEV_CHIP_IDS.unregistered` opens registration.

## NFI scan

`hooks/use-item-nfi.ts` reads an ITEM card with `@item-systems/item/mobile` (the package ships its own agent skill in `node_modules/@item-systems/item/skills/item-sdk-typescript`; read it before touching card code). `react-native-nfc-manager` provides the ISO-DEP `CardTransport`, `expo-crypto` the `RandomSource`. The scan is read-only: `ItemSecureTunnel.connect()` SELECTs the ITEM kernel and returns `CardInfo` (`uid`, `version`, `paired`). It never pairs, opens a session or signs; those need a pairing key and explicit authorization.

- Reading a card needs a phone with NFC running the development build (`pnpm ios --device` / `pnpm android`). iOS only selects AIDs listed in the `react-native-nfc-manager` plugin's `selectIdentifiers` in `app.json`.
- The iOS simulator and emulators have no NFC reader: `isNfiScanAvailable` is false and scan/confirm add "Simulate tap" buttons below the real tap button in dev builds. Detection uses `isSupported(NfcTech.IsoDep)` and rechecks when the app becomes active (Android rejects the call before its Activity attaches).

## Adding things

- **Screen**: create `src/routes/screens/<path>/index.tsx` and register it in the `screens` group in `src/routes/stack.tsx` as `'(screens)/<path>'` with a matching `linking` path. Params go in `types.ts`. Screens that need a signed-in user start with `useRequiredSession()` and render `null` until it returns a session.
- **Endpoint**: add the function to `api/mock-server.ts`, the types to `api/types.ts`, and an endpoint to `store/api/vault-api.ts` (invalidate `'Vault'` if it changes the vault).
- **Drawer**: create `src/routes/drawers/<domain>/<name>/index.tsx` and add `'(drawers)/<domain>/<name>'` to the `drawers` group in `stack.tsx`.
- **Slice**: create `src/store/slices/foo-slice.ts`, add it to `combineSlices(...)` in `src/store/index.ts`. Export actions and `slice.selectors`. Put cross-slice selectors in `store/selectors.ts`.
- **Native dependency**: `pnpm expo install <pkg>`, then rebuild the app (`pnpm ios` / `pnpm android`).

## Before finishing a task

- `pnpm format`, then `pnpm lint` and `pnpm format:check` pass (Markdown is not formatted; `.prettierignore`).
- `pnpm tsc --noEmit` passes. If `className` errors appear, run Metro once (`pnpm start`) to regenerate `src/uniwind-types.d.ts`.
- `pnpm dlx expo-doctor` passes after any dependency change.
