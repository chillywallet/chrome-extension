# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Chilly Wallet — a multi-chain EVM crypto wallet extension for Chrome (MV3). The architecture is derived from MetaMask's extension: same `@metamask/*` controller/permission/json-rpc packages, same background-controller + multiplexed-stream layout. When something looks unfamiliar, the MetaMask extension source is usually the reference.

The wallet is **backend-free**: there is no proprietary server, no login, and no remote config. All chain data comes from free public APIs (Blockscout / Etherscan V2 / BlockVision for holdings, history, NFTs; DefiLlama / CoinGecko for prices; OpenOcean for swap quotes), selected per chain by the committed registry in `src/config/`. Key custody was always local (bip39 seed + PIN vault).

## Commands

```bash
npm install                  # no registry auth needed; all deps resolve from public npm
npm run debug                # watch build -> build/debug (static extension key)
npm run staging              # watch build -> build/staging (static key)
npm run debug:build          # one-off (non-watch) debug build; run this before npm run test:e2e
npm run build-dev            # one-off dev build -> build/dev + zip
npm run build-prod           # one-off prod build -> build/prod + zip
npm run css                  # tailwind watch -> build/debug/css/pages.css
npm run typecheck            # tsc --noEmit
```

**This project uses npm, not yarn** — `package-lock.json` is the lockfile. `.npmrc` sets `legacy-peer-deps=true` because `react-scripts@5.0.1` declares a peer of `typescript@^3 || ^4` while the project builds on TypeScript 5; without it every install fails with ERESOLVE. Don't remove that line without upgrading or dropping react-scripts (which is only there to run Jest).

Load the unpacked extension from `build/<target>/` in `chrome://extensions`.

`.env.*` files are **optional**. All runtime configuration (RPC URLs, provider endpoints, feature flags) is committed in `src/config/`; a build with no `.env` file produces a fully working extension. The only env vars still consumed are the Playwright ones below (`dotenv-webpack` is still wired with `silent: true`, so a missing file is not an error).

### Tests

```bash
npm test                     # jest (craco), all of tests/**
npm run test:watch           # same, in watch mode
npm run test:coverage        # what CI runs; posts a coverage comment on PRs
npm test -- tests/lib/web3.test.ts      # single file (note the -- separator)
npm test -- -t "some test name"         # single test by name
npm run test:e2e             # playwright, requires an existing build/debug/
```

Arguments to `npm test` need a `--` separator before them, unlike `yarn test`.

Jest runs only files under `tests/` (`testMatch` in `package.json`), mirroring `src/` layout (`tests/controller/`, `tests/lib/`). Coverage is collected from `src/**` with type/constant files excluded. Two jest gotchas: CRA sets `resetMocks: true`, so `jest.fn()` implementations are wiped between tests — set them inside `beforeEach`, not at module scope; and both `nanoid` (ESM-only) and `axios` are redirected to `__mocks__/` via `moduleNameMapper`, so network code under test hits the stub, not the real client.

`tests/coverage-imports.test.ts` exists purely to side-effect-import type/constant/enum modules that have no logic. Add new pure-constant modules there rather than writing a throwaway spec.

**CI** (`.github/workflows/test.yml`) runs `npm ci` then `npm run test:coverage` on Node 22, on PRs into `main` or `develop`, and posts a coverage comment. E2E is not in CI — Playwright is local-only. Formatting helpers formerly from a scoped registry package are vendored at `src/shared/utils/format.js` (compiled lib code — treat as a library).

Playwright loads the unpacked extension from `build/debug/` as a persistent context, so **build first** (`npm run debug:build`). It reads `.env.debug` for `PLAYWRIGHT_PIN_CODE` and `PLAYWRIGHT_SEED_PHRASE` (used by `01-onboarding.spec.ts` to drive wallet import). Specs in `e2e/` are numbered (`01-onboarding`, `03-contact`, …) and run with `workers: 1` because they share one wallet session in `test-results/session`. Always import `test`/`expect` from `e2e/util.ts`, not from `@playwright/test`.

## Build system

Two independent toolchains, easy to confuse:

- **Webpack** (`{debug,staging,dev,prod}.webpack.config.js`) builds the actual extension. The four configs differ only in output dir, mode/devtool, and `.env` file. `scripts/build.sh` wipes `build/<target>/`, copies `extension/*` (static HTML, manifest, icons, vendored `echarts.js`, phishing detector), compiles Tailwind, then runs webpack — `--watch` for debug/staging, one-shot + zip for dev/prod.
- **craco/react-scripts** is used *only* to run Jest. There is no CRA dev server.

Five webpack entries map to the manifest: `ui` (`src/App.tsx`), `background`, `offscreen`, `inpage`, `contentscript` → `build/<target>/scripts/<name>.js`.

The `static-key` argument to `build.sh` swaps `manifest-static-key.json` in for `manifest.json`, pinning the extension ID (needed for e2e). `debug`/`staging` always use it; prod/dev builds use it only via `build-prod-static`/`build-dev-static`.

Note `tsconfig.json` sets `noEmit: true`; `ts-loader` overrides it per-build. Type errors surface during webpack builds or via `npm run typecheck`.

## Chain & provider configuration

`src/config/` is the single source of truth for everything per-chain. This is the layer to touch when adding a chain or switching where data comes from:

- `types.ts` — `ChainConfig` extends the legacy `ChainData` shape with `rpcUrls: string[]` (preference-ordered alternatives — **not** automatic failover; only `rpcUrl`, which mirrors `rpcUrls[0]`, is ever dialled), `dataProvider: { kind, baseUrl, apiKeyRef? }`, `priceProvider: { kind, llamaSlug? }`, `swapProvider: { kind, providerChainSlug? }`.
- `chains.ts` — the registry (`CHAINS` + per-chain `CHAIN_CONFIG_*` exports). Provider assignment: Monad + Monad testnet + BSC/Amoy → Etherscan V2 multichain (`api.etherscan.io/v2/api?chainid=N`, one free key covers all of them — chain 143 is the monadscan backend); Ethereum/Base/Polygon/Arbitrum + the Sepolias → Blockscout instances (no key); Avalanche → Routescan (etherscan-compatible, no key). `getDataProviderPresets(chainId)` returns the selectable providers for a chain — committed default first, then Etherscan V2 (every chain in this registry is in its chain list), BlockVision for the Monad chains only, then `none`. It is what the Developer Settings picker renders, so new alternatives are added there rather than hardcoded in the UI.
- `defaults.ts` — `DEFAULT_CHAIN_ID`, feature flags, the static Earn list (Monad liquid staking), and `STATIC_REMOTE_DATA` (what Firebase Remote Config used to supply; dispatched at UI startup by `src/ui/components/StaticConfigHandler.tsx`).
- `apiKeys.ts` — committed defaults (empty) plus `API_KEY_INFO` (label/signup URL/description per key, rendered by the settings editor). User-supplied keys live in `preferences.apiKeys`, keyed by `apiKeyRef`, and win over the committed defaults.

**User overrides:** `src/ui/pages/Develop.tsx` ("Developer Settings") is where users enter their own API keys and pick a data provider per chain. Both write through dedicated `PreferencesController` methods — `setApiKey(apiKeyRef, key)` and `setChainDataProvider(chainId, config | null)` — rather than the generic `setPreferences`, which shallow-merges at the top level and would clobber the sibling entries of `apiKeys`/`customNetworks`. Passing `null`/`''` clears an override so the committed default applies again. `getDataProvider` caches by `chainId:kind:baseUrl:apiKey`, so a changed key or provider takes effect on the next fetch with no reload. Note `setCustomNetworks` is reachable from dapps via `wallet_addEthereumChain`; it merges into the existing entry so a dapp adding an RPC can't drop the user's provider choice.
- `index.ts` — `resolveChainConfig(chainId, overrides)` (user custom networks win over committed defaults) and `resolveApiKey(apiKeyRef, userApiKeys)`.

`src/lib/ChainsUtils.tsx` derives `CURRENT_CHAINS` from this registry; `src/lib/rpcProvider.ts` (`makeProvider(chainId)`) is the one place JsonRpcProviders are constructed.

**Chain identity:** `platform_id === chain_id` everywhere (the legacy backend platform ids are gone). Persisted state from old installs is remapped by Migrator versions 6–8 in `src/Background.tsx` — v6 drops the deleted backend controllers' state, v7 remaps storage keys to chain ids, v8 renames pre-rebrand persisted fields to their current names (`chain_key`, `platform_id`, `coinId`; the v8 migration source is the reference for the old spellings, which appear nowhere else). Coin ids (`coinId`) are synthetic: `cg:{coingecko-id}` for market coins, `{chainId}:{tokenAddress}` for on-chain tokens.

### Provider layers (all pluggable)

- **Data providers** (`src/lib/dataproviders/`) supply holdings, transaction history, and NFTs. `DataProvider.ts` defines the interface (`getTokenHoldings` / `getTransactions` / `getNFTs`) and a self-registering factory (`registerDataProvider` / `getDataProvider(chainId)`); adapters: `BlockscoutProvider` (REST v2, keyset `next_page_params` pagination — sequential page access only), `EtherscanV2Provider` (token set derived from `tokentx` history, balances refreshed on-chain), `BlockVisionProvider` (`x-api-key`, ~2 QPS — no longer a default, opt-in per chain for better Monad NFT data). `classify.ts` reproduces the semantic tx `type`/`method` strings the UI's icon/name logic matches. A configured-but-missing key throws `MissingApiKeyError`, which the UI treats as "no data" rather than an error. All HTTP goes through `fetchJson` with a per-provider limiter from `RateLimiters` (`src/shared/utils/rateLimiter`).
- **Price providers** (`src/lib/priceproviders/`): `defillama.ts` for on-chain token prices/charts (`{llamaSlug}:{address}`, natives via `coingecko:{id}`), `coingecko.ts` free tier for Explore/market lists and `cg:` charts.
- **Swap provider** (`src/lib/swapproviders/openocean.ts`): OpenOcean v4, returns ready-to-send `{to, data, value}` calldata mapped into the existing `SwapQuotes` shape; execution uses the normal TransactionController path (EOA only — there is no smart-account/gasless machinery).

**Coin ids:** `coinId` is the live synthetic coin identifier (`cg:{coingecko-id}` for market coins, `{chainId}:{tokenAddress}` for on-chain tokens); price caching, favourites and coin lookup all key off it. The unrelated `internalId` in `src/lib/message-manager/*` is a per-message tracking id (MetaMask's `metamaskId` pattern), stripped before signing.

**Legacy facade:** `src/api/graphQL/` is no longer GraphQL. `MarketRequest`/`WalletRequest` are local facades over the provider layers that preserve the old response envelopes (e.g. `{data: {coins: …}}`, `{data: {getSwapQuotes: …}}`) so call sites didn't move; `BaseRequest` retains only the error-message helpers. Custom tokens and hidden-token flags are purely local (`src/lib/customTokens.ts`, stored in preferences). Contacts are local CRUD in `ContactsController`.

## Architecture

### Processes and streams

```
inpage.js (MAIN world)  <-WindowPostMessageStream->  contentscript.js  <-PortStream->  background.js
UI (popup/sidepanel/notification/fullscreen)        <-PortStream->                     background.js
```

Every port is wrapped in an `ObjectMultiplex` (`src/lib/stream-utils.js`). Channel names live in `src/shared/constants/stream.tsx`:

- `controller` — trusted UI ↔ background JSON-RPC (the wallet API)
- `provider` (INTERNAL_PROVIDER) — EIP-1193 provider for the UI itself
- `chilly-provider` (EXTERNAL_PROVIDER) — untrusted dapp provider traffic

`AppController.setupTrustedCommunication` serves the first two; `setupUntrustedCommunication` serves dapps.

### Background: AppController

`src/controller/AppController.tsx` is the composition root. It instantiates every controller in `src/controller/`, wires them together through a `ControllerMessenger` (`@metamask/base-controller`), and composes their `ObservableStore`s into a `ComposableObservableStore` that is persisted to `browser.storage` via `LocalStore` and versioned by `Migrator`.

Controllers own domain state (`AccountController`, `KeyringController`, `NetworkController`, `TransactionController`, `PortfolioController`, `PreferencesController`, `ContactsController`, `LiquidStakingController`, …) and communicate cross-controller via messenger actions/events (`KeyringController:unlock`, `NetworkController:networkChange`, …) rather than direct references.

Provider-backed data fetching (holdings/history/NFTs/prices) runs in the **UI process** (`src/shared/utils/portfolio.tsx`, `src/lib/CoinsUtils.tsx`), not the background.

### UI ↔ background contract

`AppController.getApi()` returns a flat `{ methodName: boundFn }` map. `createRPCHandler` (`src/lib/RPCHandler.js`) dispatches inbound JSON-RPC over the `controller` stream against that map, and persists state after every non-`getState` call. On the UI side `createRPCClientFactory` produces the client, `submitRequestToBackground(method, args)` (`src/store/backgroundConnection.tsx`) is the only call path, and thunks in `src/store/actions/uiActions.tsx` wrap it.

**Adding a background method requires three edits:** implement it on the controller, expose it in `getApi()`, add a thunk in `uiActions.tsx`.

State pushes the other direction: `AppController` emits `update` → written as a `sendUpdate` JSON-RPC notification → `src/ui/index.tsx` dispatches `updateGlobalState` into Redux (`state.globalState`). The UI does not mutate wallet state locally.

**BigInt gotcha:** JSON-RPC over the stream can't carry BigInt. Params, results, and update payloads pass through `serializeBigInt`/`deserializeBigInt` (`src/lib/bigintSerializer.tsx`) at every boundary. New values that carry BigInts must survive that round-trip.

### Dapp RPC path

Dapp requests enter the background as a `JsonRpcEngine` per connection. `AppController.setupProviderConnection` stacks middleware from `src/lib/`: origin → tab id → logger → dupe-req filter → selected-network → permission-controller → `createMethodMiddleware` (wallet-specific methods, `src/lib/rpc-method-middleware/`) → `createChillyMiddleware`/`createWalletMiddleware` (signing, tx submission) → `createProviderMiddleware` (network RPC). Permissions use `@metamask/permission-controller` with specs in `src/lib/permissions/`; user-facing confirmations go through `ApprovalController` and open a notification window via `NotificationManager`.

### EIP-5792 batch calls

`src/lib/eip5792/` implements `wallet_sendCalls` / `wallet_getCallsStatus` / `wallet_getCapabilities`, dispatched from `src/lib/rpc-method-middleware/eip5792.tsx` and confirmed in the UI by `src/ui/pages/DappInteraction/SendCallsConfirmation.tsx`. Atomic batching requires a deployed batch-calls contract, hardcoded in `capabilities.tsx` — currently Monad (143) and Base (8453) only; every other chain reports `atomic: unsupported` while still accepting sequential `sendCalls`. Batch state lives in `callBatchStore.tsx`.

This is the only batching mechanism. **Gasless is fully gone** — the relayer, the `GaslessProvider` shim, and `TransactionController.resetGaslessAccount` have all been deleted. `GasFee` now reports fee problems through an `onError` prop and each confirmation screen owns that state locally; there is no fee/error context. The `calls` prop that confirmations pass to `GasFee` (once named `gaslessCalls`, now `confirmCalls`) is live — it is how the component accounts for value already being sent.

### Name resolution

Two independent services, both Monad-scoped and called from the UI: `src/lib/NnsService.tsx` (nad.domains REST API, primary-name and resolved-address lookups) and `src/lib/AllDomainsService.tsx` (`@onsol/tldparser` reading on-chain through the Monad RPC). Covered by `e2e/09-nad-domains.spec.ts`.

### MV3 specifics

- The service worker is killed and revived constantly. `Background.tsx` gates `onConnect` on an `isInitialized` deferred promise and calls `sendReadyMessageToTabs()` on revival so content scripts reconnect.
- The UI waits for a `startUISync` message before rendering (`src/App.tsx`) — this avoids the blank-screen race — and rebuilds its streams on `onDisconnect` rather than reloading.
- `src/offscreen.ts` + `src/lib/offscreen/` host the Ledger/Trezor bridges, because WebHID/iframes are unavailable in a service worker.

### UI

React 18 + react-router-dom v5 + Redux Toolkit, rendered into `app-content` in `popup.html` / `sidepanel.html` / `home.html` / `notification.html` — same bundle, behavior branches on `getEnvironmentType()`. Pages in `src/ui/pages/`, shared components in `src/ui/components/`. Styling is Tailwind compiled from `src/ui/pages.css` into the build folder (not bundled by webpack); `tailwind.config.js` scans `src/**`.

**Design system ("Frost"):** dark-first navy surfaces (`darker`/`dark`/`header` tokens), ice accents (`primary`/`accent`), `mint` for positive deltas, coral strictly for primary CTAs. Typography is bundled — Figtree (body, applied via the Tailwind `sans` token → preflight) and Space Grotesk (`font-display`, used with `tabular-nums` for balances and titles); woff2 files live in `extension/fonts/` and are referenced by `@font-face` in `src/ui/pages.css` (`url('../fonts/…')` resolves because build output puts CSS in `css/` and copies `extension/*` verbatim — MV3 CSP forbids remote fonts). The animated `.aurora-line` gradient is the signature element: reserved for hero moments (Home balance, onboarding headline) and the active tab pill (`::after`), nowhere else. Shared shape classes in `pages.css`: `.sheet`/`.sheet-handle`/`.sheet-overlay` (Modal renders as a bottom sheet under 640px, centered card above), `.frost-card`, segmented `tab-*` classes (react-tabs), frosted `bottom-tab-*` dock. Skeletons use `.bg-placeholder`.

**Brand assets are generated, not hand-edited.** `node scripts/render-icons.js` is the single source of truth for the penguin mark: it writes the four app-icon finishes (`icon-chilly-{classic,frost,aurora,midnight}.{svg,png}` — the finishes offered by `LAUNCHER_ICONS` in `src/shared/utils/Images.tsx` and the Choose App Icon screen), the manifest set `extension/images/icon-{16,32,48,128}.png`, and the three wordmarks (`logo-chilly-*.png`, set in the bundled Space Grotesk). Two marks exist: **Classic**, the original flat silhouette, is the `DEFAULT_VARIANT` and therefore what the manifest, the wordmarks, and dapps see; Frost/Aurora/Midnight use a more detailed penguin (belly, beak, eyes) and are opt-in. Two copies of the default mark live outside that script and must be updated alongside it: the EIP-6963 `icon` data URI in `src/InPage.tsx` (what dapps display) and the inline pre-React loader SVG in the four HTML shells plus `phishing.html`. `AppIconHandler` falls back to `DEFAULT_LAUNCHER_ICON_KEY` when `preferences.appIcon` names a finish that no longer exists, so removing a finish never leaves an install without an icon.

There is no login. The route gate (`src/ui/pages/Authenticated.tsx`) is `isUnlocked && completedOnboarding`; onboarding is OnboardingHome → CreatePinCode → create/import/hardware → WalletSuccess. Home has two tabs (Explore, Wallet); Earn lists only on-chain liquid staking (aPriori/Kintsu/FastLane on Monad, from `defaults.ts`).

## Conventions

- Prettier (`.prettierrc.js`): 4-space indent, 100 cols, single quotes, `trailingComma: 'all'`, `arrowParens: 'avoid'`, `bracketSameLine`. No lint script — formatting is by editor/Prettier.
- `.tsx` is used for plain TypeScript modules too (most of `src/lib`, `src/shared`); some older infrastructure is still `.js`.
- `@metamask/*` types often disagree with local ones; the codebase uses targeted `//@ts-ignore` rather than loosening `strict`.
- Chrome APIs go through `webextension-polyfill` (`import browser from 'webextension-polyfill'`), not bare `chrome.*`.
- Logging goes through `src/shared/utils/logger`, not `console`.

## Agent skills

`.cursor/rules/review-agent-skills.mdc` applies to this repo: before substantive work, inventory `.agents/skills/*/SKILL.md` and read any that are relevant or borderline. Present: `playwright-best-practices` (read before touching `e2e/`), `tailwind-design-system` and `frontend-design` (UI/styling work), `vercel-react-best-practices` (React perf), `find-skills`. `skills-lock.json` pins their upstream sources.
