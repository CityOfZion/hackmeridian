@AGENTS.md

## App

VaultPass: a hardware-secured payment card demo on Stellar, ported from a Figma Make web prototype. Three roles, picked on the first screen:

- **Bank**: network overview, cardholder list/detail (suspend, freeze), card issuing, network controls (merchant acceptance, emergency freeze).
- **Card Holder**: always operates holder `maya` (`CURRENT_HOLDER_ID`): card, balance, daily limit, lock, activity, card face.
- **Merchant**: keypad charge → tap → result, daily summary. "Scan card" reads a real ITEM NFI (see NFI scan below), then charges the Card Holder's account through `chargeCard`, which enforces network freeze, merchant acceptance, card state and daily limit.

All data is in-memory Redux seed data. There is no backend or chain integration yet; the only hardware integration is the NFI scan.

## Project layout

```
index.ts                       registerRootComponent → src/app
metro.config.js                Uniwind Metro wrapper (keep it outermost)
assets/card/                   card face SVGs (rendered with expo-image)
src/
  app.tsx                      fonts (Outfit), Redux Provider, SafeAreaProvider, <NavigationRoot />
  global.css                   Tailwind v4 + Uniwind entry, @theme colors and font families
  theme/colors.ts              same colors for places className can't reach (SVG, navigator options)
  constants.ts                 merchant name, current holder id, limits, firmware
  routes/                      folder layout copied from neonhq (apps/mobile/src/routes)
    navigator.tsx              NavigationRoot: createStaticNavigation(stack), theme, deep linking
    stack.tsx                  every navigator: root `stack` (screens + drawers groups), the role tab stacks
                               and their per-tab stacks, RootNavigator augmentation
    screens/                   route '(screens)/<path>' lives in screens/<path>/
      role-select/
      bank/{overview,cards/{list,details},issue/{form,success},controls}/
      card-holder/{card/{home,spend-limit},activity,details}/
      merchant/{charge/{amount,tap-to-pay,result},summary}/
    drawers/                   route '(drawers)/<path>' lives in drawers/<path>/
      card/lock/
      network/freeze/
  layouts/screen-layout.tsx    ScreenLayout compound component used by every screen
  components/
    ui/                        app-text (AppText/Eyebrow), button, icon, sheet, money, ...
    card/                      physical-card (5 faces), card-design-picker, diagonal-bands
    rows/                      transaction-row, holder-row, feed-row, setting-row
  hooks/
    use-current-holder.ts      the Card Holder role's holder + today's spend
    use-item-nfi.ts            ITEM NFI scan over NFC (useScanItemNfi)
  store/
    index.ts                   configureStore + combineSlices, RootState / AppDispatch / AppThunk
    slices/                    holders, transactions (entity adapters), network, merchant (keypad draft)
    selectors.ts               cross-slice memoized selectors (spend today, ledgers, counts)
    thunks/payments.ts         chargeCard
  utils/                       cn (tailwind-merge), formatting, id generators
```

## Conventions

- **Naming**: every file and folder is kebab-case (`spend-limit/`, `app-text.tsx`, `use-current-holder.ts`, `holders-slice.ts`). Exported identifiers keep normal TS casing (`BankCardsDetailsScreen`, `useCurrentHolder`).
- **Routes** follow neonhq: the route name is the folder path inside `routes/`, with the group in parentheses: `'(screens)/bank/cards/details'` is `routes/screens/bank/cards/details/index.tsx`, `'(drawers)/card/lock'` is `routes/drawers/card/lock/index.tsx`. Navigator routes are PascalCase and end in `Stack` (`BankTabStack`, `BankCardsStack`).
- **Screens and drawers**: the component is the named export in `index.tsx`, named after the path (`BankCardsDetailsScreen`, `CardLockDrawer`). Route params go in `types.ts` beside it (`TBankCardsDetailsScreenParams`), used as `StaticScreenProps<TBankCardsDetailsScreenParams>`. Helpers used only by that route live in the same folder with a `-` prefix (`issue/form/-process-rail.tsx`, `tap-to-pay/-nfc-rings.tsx`).
- **Imports**: use the `@/` alias (`@/components/ui/button`, `tsconfig.json` paths) for anything outside the current folder; `./` only for siblings, grouped after the `@/` imports.
- Always render text through `AppText` (or `Eyebrow`). RN text doesn't inherit fonts, so raw `<Text>` falls back to the system font.
- **No fixed pixels in classNames.** Tailwind v4's spacing scale is dynamic (`--spacing` = 0.25rem), so write `px-5.5`, `size-20.5`, `max-w-100`, not `px-[22px]`. Font sizes come from the type scale (`text-4xs`/`3xs`/`2xs` are custom tokens in `global.css`, then Tailwind's `xs`…`6xl`); letter-spacing uses `tracking-tight|tighter|widest` (em-based); line-height uses `leading-none|tight|normal|relaxed`; radii use `rounded-lg|3xl|full`. Safe areas use Uniwind's `pt-safe`, `pt-safe-offset-3`, ... (fed by `SafeAreaListener` in `app.tsx`; apply them to Views, not `contentContainerClassName`). Third-party components that only take `style` get `className` via `withUniwind(...)`. Inline `style` is only for animated or computed values (e.g. a progress `%`).
- Font weight is a font family: use `font-outfit`, `font-outfit-medium`, `font-outfit-semibold` or `font-outfit-bold`, never `font-bold`.
- Use `cn()` to merge an overridable `className` prop.
- Navigate to nested screens with the typed nested form: `navigation.navigate('BankTabStack', { screen: 'BankCardsStack', params: { screen: '(screens)/bank/cards/details', params: { holderId } } })`.
- Every screen is built from `ScreenLayout` parts; navigator headers are off:
  ```tsx
  <ScreenLayout>                        {/* className to change the background */}
    <ScreenLayout.Header>               {/* fixed; owns the top safe-area inset */}
      <ScreenLayout.Heading>
        <ScreenLayout.Eyebrow>BANK OWNER</ScreenLayout.Eyebrow>
        <ScreenLayout.Title>Cardholders</ScreenLayout.Title>
      </ScreenLayout.Heading>
      <ScreenLayout.BackButton />       {/* optional; goBack() unless onPress */}
    </ScreenLayout.Header>
    <ScreenLayout.Body>…</ScreenLayout.Body>       {/* ScrollView with page gutters; takes ScrollView props */}
    <ScreenLayout.Footer>…</ScreenLayout.Footer>   {/* optional pinned primary actions */}
  </ScreenLayout>
  ```
  Put the primary CTA in `Footer`, except on screens with text inputs (the keyboard would cover it). A screen without `Header` (role select) must handle the top inset in `Body`.
- Confirmation dialogs are drawers: `src/routes/drawers/<domain>/<name>/index.tsx` (named export `XDrawer`), registered in the root `drawers` group (`transparentModal`) and built on `<Sheet>`.

## Deep links (dev)

Every leaf screen sets `linking` in `stack.tsx` to its route name without the group, so `'(screens)/bank/cards/details'` opens at `bank/cards/details`. Navigator routes add nothing to the path. With the development build installed:

```
xcrun simctl openurl booted "vaultpass://bank/cards/details?holderId=liam"
xcrun simctl openurl booted "vaultpass://merchant/charge/tap-to-pay?amount=12.5"
xcrun simctl openurl booted "vaultpass://card/lock"
```

Numeric params need a `parse` entry in the screen's `linking` config (see tap-to-pay).

## NFI scan

`hooks/use-item-nfi.ts` reads an ITEM card with `@item-systems/item/mobile` (the package ships its own agent skill in `node_modules/@item-systems/item/skills/item-sdk-typescript`; read it before touching card code). `react-native-nfc-manager` provides the ISO-DEP `CardTransport`, `expo-crypto` the `RandomSource`. The scan is read-only: `ItemSecureTunnel.connect()` SELECTs the ITEM kernel and returns `CardInfo` (`uid`, `version`, `paired`). It never pairs, opens a session or signs; those need a pairing key and explicit authorization.

- Reading a card needs a phone with NFC running the development build (`pnpm ios --device` / `pnpm android`). iOS only selects AIDs listed in the `react-native-nfc-manager` plugin's `selectIdentifiers` in `app.json`.
- The iOS simulator and emulators have no NFC reader: `isNfiScanAvailable` is false and tap-to-pay shows "Simulate card tap" in dev builds instead.

## Adding things

- **Screen**: create `src/routes/screens/<role>/<tab>/<screen>/index.tsx` and register it in that tab's stack in `src/routes/stack.tsx` as `'(screens)/<role>/<tab>/<screen>'` with a matching `linking` path. Params go in `types.ts`.
- **Drawer**: create `src/routes/drawers/<domain>/<name>/index.tsx` and add `'(drawers)/<domain>/<name>'` to the `drawers` group in `stack.tsx`.
- **Slice**: create `src/store/slices/foo-slice.ts`, add it to `combineSlices(...)` in `src/store/index.ts`. Export actions and `slice.selectors`. Put cross-slice selectors in `store/selectors.ts`.
- **Native dependency**: `pnpm expo install <pkg>`, then rebuild the app (`pnpm ios` / `pnpm android`).

## Before finishing a task

- `pnpm format`, then `pnpm lint` and `pnpm format:check` pass (Markdown is not formatted; `.prettierignore`).
- `pnpm tsc --noEmit` passes. If `className` errors appear, run Metro once (`pnpm start`) to regenerate `src/uniwind-types.d.ts`.
- `pnpm dlx expo-doctor` passes after any dependency change.
