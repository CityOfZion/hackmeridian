@AGENTS.md

## App

VaultPass: a hardware-secured payment card demo on Stellar, ported from a Figma Make web prototype. Three roles, picked on the first screen:

- **Bank**: network overview, cardholder list/detail (suspend, freeze), card issuing, network controls (merchant acceptance, emergency freeze).
- **Card Holder**: always operates holder `maya` (`CURRENT_HOLDER_ID`): card, balance, daily limit, lock, activity, card face.
- **Merchant**: keypad charge → tap → result, daily summary. "Simulate card tap" charges the Card Holder's card through `chargeCard`, which enforces network freeze, merchant acceptance, card state and daily limit.

All data is in-memory Redux seed data. There is no backend or chain integration yet.

## Project layout

```
index.ts                       registerRootComponent → src/app
metro.config.js                Uniwind Metro wrapper (keep it outermost)
assets/card/                   card face SVGs (rendered with expo-image)
src/
  app.tsx                      fonts (Outfit), Redux Provider, SafeAreaProvider, Navigation + deep linking
  global.css                   Tailwind v4 + Uniwind entry, @theme colors and font families
  theme/colors.ts              same colors for places className can't reach (SVG, navigator options)
  constants.ts                 merchant name, current holder id, limits, firmware
  navigation/
    index.tsx                  RootStack (RoleSelect, Bank, CardHolder, Merchant, Sheets group) + RootNavigator augmentation
    bank-tabs.tsx              Overview, Cards (HolderList → HolderDetail), Issue (IssueCard → IssueSuccess), Controls, Roles
    card-holder-tabs.tsx       Card (CardHome → SpendLimit), Activity, Details, Roles
    merchant-tabs.tsx          Charge (ChargeEntry → TapToPay → PaymentResult), Summary, Roles
    role-tabs.tsx              shared tab bar options, tabIcon(), the "Roles" exit tab
  screens/
    role-select/
    bank/{overview,holder-list,holder-detail,issue-card,issue-success,controls}/
    card-holder/{card-home,spend-limit,activity,card-details}/
    merchant/{charge-entry,tap-to-pay,payment-result,summary}/
    modals/{lock-card,network-freeze}/
  components/
    layout/screen-layout.tsx   ScreenLayout compound component used by every screen
    ui/                        app-text (AppText/Eyebrow), button, icon, sheet, money, ...
    card/                      physical-card (5 faces), card-design-picker, diagonal-bands
    rows/                      transaction-row, holder-row, feed-row, setting-row
  hooks/use-current-holder.ts  the Card Holder role's holder + today's spend
  store/
    index.ts                   configureStore + combineSlices, RootState / AppDispatch / AppThunk
    slices/                    holders, transactions (entity adapters), network, merchant (keypad draft)
    selectors.ts               cross-slice memoized selectors (spend today, ledgers, counts)
    thunks/payments.ts         chargeCard
  utils/                       cn (tailwind-merge), formatting, id generators
```

## Conventions

- **Naming**: every file and folder is kebab-case (`holder-detail/`, `app-text.tsx`, `use-current-holder.ts`, `holders-slice.ts`). Exported identifiers keep normal TS casing (`HolderDetailScreen`, `useCurrentHolder`).
- **Screens**: one folder per screen, with the screen in `index.tsx` (named export `XScreen` / `XSheet`). Helpers used only by that screen live next to it in the same folder (e.g. `issue-card/process-rail.tsx`, `tap-to-pay/nfc-rings.tsx`).
- Always render text through `AppText` (or `Eyebrow`). RN text doesn't inherit fonts, so raw `<Text>` falls back to the system font.
- **No fixed pixels in classNames.** Tailwind v4's spacing scale is dynamic (`--spacing` = 0.25rem), so write `px-5.5`, `size-20.5`, `max-w-100`, not `px-[22px]`. Font sizes come from the type scale (`text-4xs`/`3xs`/`2xs` are custom tokens in `global.css`, then Tailwind's `xs`…`6xl`); letter-spacing uses `tracking-tight|tighter|widest` (em-based); line-height uses `leading-none|tight|normal|relaxed`; radii use `rounded-lg|3xl|full`. Safe areas use Uniwind's `pt-safe`, `pt-safe-offset-3`, ... (fed by `SafeAreaListener` in `app.tsx`; apply them to Views, not `contentContainerClassName`). Third-party components that only take `style` get `className` via `withUniwind(...)`. Inline `style` is only for animated or computed values (e.g. a progress `%`).
- Font weight is a font family: use `font-outfit`, `font-outfit-medium`, `font-outfit-semibold` or `font-outfit-bold`, never `font-bold`.
- Use `cn()` to merge an overridable `className` prop.
- Navigate to nested screens with the typed nested form: `navigation.navigate('Bank', { screen: 'Cards', params: { screen: 'HolderDetail', params: { holderId } } })`.
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
- Confirmation dialogs are routes in the root `Sheets` group (`transparentModal`) built on `<Sheet>`.

## Deep links (dev)

Deep linking is `enabled: 'auto'`, so paths are kebab-case screen names. With Metro on port 8081, in Expo Go:

```
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/holder-detail?holderId=liam"
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/tap-to-pay?amount=12.5"
```

Numeric params need a `parse` entry in the screen's `linking` config (see `TapToPay`).

## Adding things

- **Screen**: create `src/screens/<role>/<screen-name>/index.tsx` and register it in that role's navigator file. If it takes params, type props with `StaticScreenProps<{ ... }>`.
- **Slice**: create `src/store/slices/foo-slice.ts`, add it to `combineSlices(...)` in `src/store/index.ts`. Export actions and `slice.selectors`. Put cross-slice selectors in `store/selectors.ts`.
- **Native dependency**: `pnpm expo install <pkg>`. Native modules outside Expo Go need a dev build.

## Before finishing a task

- `pnpm format`, then `pnpm lint` and `pnpm format:check` pass (Markdown is not formatted; `.prettierignore`).
- `pnpm tsc --noEmit` passes. If `className` errors appear, run Metro once (`pnpm start`) to regenerate `src/uniwind-types.d.ts`.
- `pnpm dlx expo-doctor` passes after any dependency change.
