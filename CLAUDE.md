@AGENTS.md

## App

Stellar Vault Pass (spec: "Stellar Vault Pass — Technical Specification", Oct 2026): an ITEM NFI (the Aeroglyph "Pass") is the user's identity and key for an EURC Spend Vault on Stellar. The spec targets a PWA, but browsers can't send APDUs to the chip (Web NFC is NDEF-only), so this is a native app. One flow:

1. **Scan** (`(screens)/scan`): tap the Pass (or "Simulate scan"), then Face ID. The chip ID read over NFC is the session; it opens the dashboard.
2. **Dashboard** (`(screens)/vault/dashboard`): vault balance, the bunq virtual cards (one Pass, many cards) as a stack, sign out, and a pinned Reload button for the selected card. Tap the stack to expand it, tap a card to select it.
   - **New card** (`(screens)/cards/create`): name + card face → bunq virtual card; it starts with nothing loaded.
   - **Reload** (`(screens)/vault/reload`, `{ cardId }`): amount, capped by the vault balance → **Confirm** (`(screens)/vault/confirm`): a fresh tap of the same Pass plus Face ID (the spec's two factors for anything that moves money), then the card's bunq limit rises by the amount and the vault is debited → **Result**.

There is no backend. Cards come from bunq (sandbox by default), called straight from the app (see bunq). The vault balance is a mock in Redux (`vault-slice`, 250 EURC per app run) until the Soroban Spend Vault exists. The chip is read for real; nothing is signed on it yet. Face ID / fingerprint (`expo-local-authentication`, `hooks/use-biometric-confirm.ts`) stands in for the spec's passkey; development builds without biometric hardware skip it.

## Project layout

```
index.ts                       registerRootComponent → src/app
metro.config.js                Uniwind Metro wrapper (keep it outermost)
assets/card/                   card face SVGs (rendered with expo-image)
src/
  app.tsx                      fonts (Outfit), Redux Provider, SafeAreaProvider, <NavigationRoot />
  global.css                   Tailwind v4 + Uniwind entry, @theme colors and font families
  theme/colors.ts              same colors for places className can't reach (SVG, navigator options)
  constants.ts                 asset code, mock vault balance, limits, dev chip ID
  api/
    types.ts                   Card, CardDesign, ApiError
    bunq/                      bunq client (sandbox/production): client (headers, Response unwrap), rsa (node-forge),
                               session (installation → device → session, cached in SecureStore), cards
  routes/                      folder layout copied from neonhq (apps/mobile/src/routes)
    navigator.tsx              NavigationRoot: createStaticNavigation(stack), theme, deep linking
    stack.tsx                  root native stack: `screens` and `drawers` groups, RootNavigator augmentation
    screens/                   route '(screens)/<path>' lives in screens/<path>/
      scan/                    opens a session by tap (first screen)
      cards/create/
      vault/{dashboard,reload,confirm,result}/
    drawers/                   route '(drawers)/<path>' lives in drawers/<path>/
      session/sign-out/
  layouts/screen-layout.tsx    ScreenLayout compound component used by every screen
  components/
    ui/                        app-text (AppText/Eyebrow), button, icon, sheet, money, ...
    card/                      physical-card (card visual), card-design-picker, diagonal-bands
    nfc/                       nfc-rings (waiting-for-tap animation)
  hooks/
    use-item-nfi.ts            ITEM NFI scan over NFC (useScanItemNfi)
    use-pass-tap.ts            scan → chip ID, or simulate (usePassTap)
    use-biometric-confirm.ts   Face ID / fingerprint, the passkey stand-in (expo-local-authentication)
    use-session.ts             useRequiredChipId (redirects to scan without a scanned Pass)
  store/
    index.ts                   configureStore + combineSlices, RootState / AppDispatch
    api/cards-api.ts           RTK Query API over the bunq client (getCards, createCard, reloadCard)
    slices/session-slice.ts    scanned chip ID
    slices/vault-slice.ts      mocked vault balance
  utils/                       cn (tailwind-merge), formatting, randomHex
```

## Conventions

- **Naming**: every file and folder is kebab-case (`spend-limit/`, `app-text.tsx`, `use-current-holder.ts`, `holders-slice.ts`). Exported identifiers keep normal TS casing (`BankCardsDetailsScreen`, `useCurrentHolder`).
- **Routes** follow neonhq: the route name is the folder path inside `routes/`, with the group in parentheses: `'(screens)/vault/confirm'` is `routes/screens/vault/confirm/index.tsx`, `'(drawers)/session/sign-out'` is `routes/drawers/session/sign-out/index.tsx`. Nested navigator routes, if added, are PascalCase and end in `Stack`.
- **Screens and drawers**: the component is the named export in `index.tsx`, named after the path (`VaultConfirmScreen`, `SessionSignOutDrawer`). Route params go in `types.ts` beside it (`TVaultConfirmScreenParams`), used as `StaticScreenProps<TVaultConfirmScreenParams>`. Helpers used only by that route live in the same folder with a `-` prefix (`vault/reload/-keypad.tsx`, `scan/-use-title-entrance.ts`).
- **Imports**: use the `@/` alias (`@/components/ui/button`, `tsconfig.json` paths) for anything outside the current folder; `./` only for siblings, grouped after the `@/` imports.
- Always render text through `AppText` (or `Eyebrow`). RN text doesn't inherit fonts, so raw `<Text>` falls back to the system font.
- **No fixed pixels in classNames.** Tailwind v4's spacing scale is dynamic (`--spacing` = 0.25rem), so write `px-5.5`, `size-20.5`, `max-w-100`, not `px-[22px]`. Font sizes come from the type scale (`text-4xs`/`3xs`/`2xs` are custom tokens in `global.css`, then Tailwind's `xs`…`6xl`); letter-spacing uses `tracking-tight|tighter|widest` (em-based); line-height uses `leading-none|tight|normal|relaxed`; radii use `rounded-lg|3xl|full`. Safe areas use Uniwind's `pt-safe`, `pt-safe-offset-3`, ... (fed by `SafeAreaListener` in `app.tsx`; apply them to Views, not `contentContainerClassName`). Third-party components that only take `style` get `className` via `withUniwind(...)`. Inline `style` is only for animated or computed values (e.g. a progress `%`).
- Font weight is a font family: use `font-outfit`, `font-outfit-medium` or `font-outfit-semibold` (the only weights loaded), never `font-bold`.
- Use `cn()` to merge an overridable `className` prop.
- Navigate with typed route names: `navigation.navigate('(screens)/vault/confirm', { amount })`. After sign-in or sign-out, `navigation.reset(...)` so back can't return across the session boundary.
- Every screen is built from `ScreenLayout` parts; navigator headers are off:
  ```tsx
  <ScreenLayout>                        {/* className to change the background */}
    <ScreenLayout.Header>               {/* fixed; owns the top safe-area inset */}
      <ScreenLayout.Heading>
        <ScreenLayout.Eyebrow>SPEND VAULT</ScreenLayout.Eyebrow>
        <ScreenLayout.Title>Reload card</ScreenLayout.Title>
      </ScreenLayout.Heading>
      <ScreenLayout.BackButton />       {/* optional; goBack() unless onPress */}
    </ScreenLayout.Header>
    <ScreenLayout.Body>…</ScreenLayout.Body>       {/* ScrollView with page gutters; takes ScrollView props */}
    <ScreenLayout.Footer>…</ScreenLayout.Footer>   {/* optional pinned primary actions; owns the bottom safe-area inset */}
  </ScreenLayout>
  ```
  Put the primary CTA in `Footer`, except on screens with text inputs (the keyboard would cover it). A screen without `Header` (scan) must handle the top inset in `Body`; a screen without `Footer` (scan, cards/create) must keep its last content clear of the bottom inset (`pb-safe` on a View).
- Confirmation dialogs are drawers: `src/routes/drawers/<domain>/<name>/index.tsx` (named export `XDrawer`), registered in the root `drawers` group (`transparentModal`) and built on `<Sheet>`.

## Deep links (dev)

Every screen sets `linking` in `stack.tsx` to its route name without the group, so `'(screens)/vault/confirm'` opens at `vault/confirm`. Screens behind the scan send you back to scan without a scanned Pass (use "Simulate scan" first). With the development build installed:

```
xcrun simctl openurl booted "vaultpass://vault/dashboard"
xcrun simctl openurl booted "vaultpass://cards/create"
xcrun simctl openurl booted "vaultpass://session/sign-out"
```

Numeric params need a `parse` entry in the screen's `linking` config (see vault/confirm). Errors from bunq and the cards API print to the Metro terminal in development (`[bunq] …`, `[api] …`).

## bunq

Cards are bunq virtual Mastercards (spec "bunq integration detail"), in the sandbox (`https://public-api.sandbox.bunq.com/v1`) unless `EXPO_PUBLIC_BUNQ_ENV=production` (`https://api.bunq.com/v1`). The spec keeps bunq credentials on the COZ backend; until it exists, `src/api/bunq/` does the API context on the device. EXPO_PUBLIC_ values are bundled in plain text: a production key goes only into local builds that are never distributed (no EAS builds, no updates), and production cards and limits are real money.

- API key: `EXPO_PUBLIC_BUNQ_API_KEY` in `.env.local` (see `.env.example`). Without it, the app creates its own sandbox user (`POST /sandbox-user-person`), so each install starts with no cards; production requires a key. Set a shared key so the team sees the same cards. SecureStore keys are per environment (`bunq.<env>.*`), so switching never reuses the other environment's session.
- First call: a 2048-bit RSA key pair in JS (a few seconds; the dashboard says "Connecting to bunq…"), `POST /installation`, `POST /device-server` (`permitted_ips: ['*']`, falling back to IP-bound), then `POST /session-server` signed with `X-Bunq-Client-Signature`. Keys, tokens and the session live in `expo-secure-store`; a 401 reopens the session once.
- `GET /cards` → `GET /user/{id}/card` (ACTIVE and DEACTIVATED cards; others hidden). Label = `second_line` (max 17 chars), last four = `primary_account_numbers[0].four_digit`, loaded balance = `card_limit`.
- `POST /cards` → `POST /user/{id}/card-debit` (`MASTERCARD` / `MASTERCARD_DEBIT`, `VIRTUAL_DELIVERY`, first active IBAN, first allowed `card-name`), then `PUT` status ACTIVE and `card_limit` 0 (new cards come with 1000 EUR). Sandbox virtual cards stay DEACTIVATED, so the app treats DEACTIVATED as usable.
- Reload raises the card's `card_limit` by the amount (`PUT /user/{id}/card/{cardId}`); the mock vault is debited only after bunq accepts.
- Card faces aren't stored in bunq: the chosen face lasts for the app run, otherwise it's derived from the card ID.
- Every Pass sees the same bunq user's cards; a backend will map cards to Passes.
- Chip signing isn't wired: real derive/sign needs the card's pairing key (`tunnel.open`), and the firmware has no Ed25519 (P-256/K1 only).
- Responses aren't verified against bunq's server signature yet.

## NFI scan

`hooks/use-item-nfi.ts` reads an ITEM card with `@item-systems/item/mobile` (the package ships its own agent skill in `node_modules/@item-systems/item/skills/item-sdk-typescript`; read it before touching card code). `react-native-nfc-manager` provides the ISO-DEP `CardTransport`, `expo-crypto` the `RandomSource`. The scan is read-only: `ItemSecureTunnel.connect()` SELECTs the ITEM kernel and returns `CardInfo` (`uid`, `version`, `paired`). It never pairs, opens a session or signs; those need a pairing key and explicit authorization.

- Reading a card needs a phone with NFC running the development build (`pnpm ios --device` / `pnpm android`). iOS only selects AIDs listed in the `react-native-nfc-manager` plugin's `selectIdentifiers` in `app.json`.
- The iOS simulator and emulators have no NFC reader: `isNfiScanAvailable` is false and dev builds also show "Simulate scan" on confirm. Scan always shows "Simulate scan" and "Simulate new Pass" below the real tap button, for demos without a Pass; confirm shows it when the session came from a simulated Pass. Detection uses `isSupported(NfcTech.IsoDep)` and rechecks when the app becomes active (Android rejects the call before its Activity attaches).

## Adding things

- **Screen**: create `src/routes/screens/<path>/index.tsx` and register it in the `screens` group in `src/routes/stack.tsx` as `'(screens)/<path>'` with a matching `linking` path. Params go in `types.ts`. Screens behind the scan start with `useRequiredChipId()` and render `null` until it returns a chip ID.
- **bunq call**: add the function to `api/bunq/` (wrap it in `withBunqSession`), then an endpoint in `store/api/cards-api.ts` (invalidate `'Cards'` if it changes cards).
- **Drawer**: create `src/routes/drawers/<domain>/<name>/index.tsx` and add `'(drawers)/<domain>/<name>'` to the `drawers` group in `stack.tsx`.
- **Slice**: create `src/store/slices/foo-slice.ts`, add it to `combineSlices(...)` in `src/store/index.ts`. Export actions and `slice.selectors`. Put cross-slice selectors in `store/selectors.ts`.
- **Native dependency**: `pnpm expo install <pkg>`, then rebuild the app (`pnpm ios` / `pnpm android`).

## Before finishing a task

- `pnpm format`, then `pnpm lint` and `pnpm format:check` pass (Markdown is not formatted; `.prettierignore`).
- `pnpm tsc --noEmit` passes. If `className` errors appear, run Metro once (`pnpm start`) to regenerate `src/uniwind-types.d.ts`.
- `pnpm dlx expo-doctor` passes after any dependency change.
