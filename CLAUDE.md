@AGENTS.md

## App

VaultPass: a hardware-secured payment card demo on Stellar, ported from a Figma Make web prototype. Three roles, picked on the first screen:

- **Bank**: network overview, cardholder list/detail (suspend, freeze), card issuing, network controls (merchant acceptance, emergency freeze).
- **Card Holder**: always operates holder `maya` (`CURRENT_HOLDER_ID`): card, balance, daily limit, lock, activity, card face.
- **Merchant**: keypad charge → tap → result, daily summary. "Simulate card tap" charges the Card Holder's card through `chargeCard`, which enforces network freeze, merchant acceptance, card state and daily limit.

All data is in-memory Redux seed data. There is no backend or chain integration yet.

## Project layout

```
index.ts                     registerRootComponent → src/App
metro.config.js              Uniwind Metro wrapper (keep it outermost)
assets/card/                 card face SVGs (rendered with expo-image)
src/
  App.tsx                    fonts (Outfit), Redux Provider, SafeAreaProvider, Navigation + deep linking
  global.css                 Tailwind v4 + Uniwind entry, @theme colors and font families
  theme/colors.ts            same colors for places className can't reach (SVG, navigator options)
  constants.ts               merchant name, current holder id, limits, firmware
  navigation/
    index.tsx                RootStack (RoleSelect, Bank, CardHolder, Merchant, Sheets group) + RootNavigator augmentation
    BankTabs.tsx             Overview, Cards (HolderList → HolderDetail), Issue (IssueCard → IssueSuccess), Controls, Roles
    CardHolderTabs.tsx       Card (CardHome → SpendLimit), Activity, Details, Roles
    MerchantTabs.tsx         Charge (ChargeEntry → TapToPay → PaymentResult), Summary, Roles
    roleTabs.tsx             shared tab bar options, tabIcon(), the "Roles" exit tab
  screens/{bank,cardholder,merchant,modals}/   one screen per file, named export `XScreen` / `XSheet`
  components/
    ui/                      AppText/Eyebrow, Button, Icon, Screen (scroll + sticky header), Sheet, Money, InfoRows, ...
    card/                    PhysicalCard (5 faces), CardDesignPicker, DiagonalBands
    rows/                    TransactionRow, HolderRow, FeedRow, SettingRow
  hooks/useCurrentHolder.ts  the Card Holder role's holder + today's spend
  store/
    index.ts                 configureStore + combineSlices, RootState / AppDispatch / AppThunk
    slices/                  holders, transactions (entity adapters), network, merchant (keypad draft)
    selectors.ts             cross-slice memoized selectors (spend today, ledgers, counts)
    thunks/payments.ts       chargeCard
  utils/                     cn (tailwind-merge), formatting, id generators
```

## Conventions

- Always render text through `AppText` (or `Eyebrow`). RN text doesn't inherit fonts, so raw `<Text>` falls back to the system font.
- Font weight is a font family: use `font-outfit`, `font-outfit-medium`, `font-outfit-semibold` or `font-outfit-bold`, never `font-bold`.
- Use `cn()` to merge an overridable `className` prop.
- Navigate to nested screens with the typed nested form: `navigation.navigate('Bank', { screen: 'Cards', params: { screen: 'HolderDetail', params: { holderId } } })`.
- Screens inside role tabs render their own header via `<Screen eyebrow title canGoBack>`. Navigator headers are off.
- Confirmation dialogs are routes in the root `Sheets` group (`transparentModal`) built on `<Sheet>`.

## Deep links (dev)

Deep linking is `enabled: 'auto'`, so paths are kebab-case screen names. With Metro on port 8081, in Expo Go:

```
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/holder-detail?holderId=liam"
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/tap-to-pay?amount=12.5"
```

Numeric params need a `parse` entry in the screen's `linking` config (see `TapToPay`).

## Adding things

- **Screen**: create it under the role folder in `src/screens/` and register it in that role's navigator file. If it takes params, type props with `StaticScreenProps<{ ... }>`.
- **Slice**: create `src/store/slices/fooSlice.ts`, add it to `combineSlices(...)` in `src/store/index.ts`. Export actions and `slice.selectors`. Put cross-slice selectors in `store/selectors.ts`.
- **Native dependency**: `pnpm expo install <pkg>`. Native modules outside Expo Go need a dev build.

## Before finishing a task

- `pnpm tsc --noEmit` passes. If `className` errors appear, run Metro once (`pnpm start`) to regenerate `src/uniwind-types.d.ts`.
- `pnpm dlx expo-doctor` passes after any dependency change.
