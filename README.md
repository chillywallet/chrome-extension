# Chilly Wallet

A cool multi-chain crypto wallet for Chrome (Manifest V3). Self-contained and
backend-free: all chain data comes from free public APIs, and your keys never
leave your device.

This guide covers the scripts for building and running the project. For
architecture and day-to-day development notes, see [CLAUDE.md](CLAUDE.md).

## Getting started

```bash
npm install
npm run debug
```

Then load the unpacked extension from `build/debug/` in `chrome://extensions`
(enable Developer mode first).

This project uses **npm** (`package-lock.json`). `.npmrc` sets
`legacy-peer-deps=true`, which is required: `react-scripts@5.0.1` declares a
peer dependency of `typescript@^3 || ^4` while the project builds on
TypeScript 5, so installs fail with `ERESOLVE` without it.

`.env.*` files are **optional**. All runtime configuration — RPC URLs, provider
endpoints, feature flags — is committed in `src/config/`, so a build with no
`.env` file produces a fully working extension. The only environment variables
still read are the Playwright ones and the optional data-provider API keys
(see [Testing](#testing)).

## Available Scripts

### Development builds

Both watch for changes and rebuild. They use a static extension key, so the
extension ID stays stable across rebuilds.

| Script | Output |
| --- | --- |
| `npm run debug` | `build/debug/` |
| `npm run staging` | `build/staging/` |
| `npm run debug:build` | `build/debug/`, one-off (no watch) — run this before the e2e suite |

### Release builds

One-off builds that also emit a timestamped zip in `build/`.

| Script | Output |
| --- | --- |
| `npm run build-dev` | `build/dev/` |
| `npm run build-prod` | `build/prod/` |
| `npm run build-dev-static` | `build/dev/`, with the static extension key |
| `npm run build-prod-static` | `build/prod/`, with the static extension key |

### Other

- `npm run typecheck` — `tsc --noEmit`. Type errors also surface during any webpack build.
- `npm run css` / `npm run css:staging` — Tailwind in watch mode, writing to
  `build/debug/css/pages.css` (or `build/staging/`). The build scripts already
  compile Tailwind once; use these only when iterating on styles against an
  existing build.

There is no lint script — formatting is handled by Prettier (`.prettierrc.js`).

## Testing

```bash
npm test                     # jest, everything under tests/
npm run test:watch           # jest in watch mode
npm run test:coverage        # what CI runs
npm run test:e2e             # playwright, requires an existing build/debug/
```

To pass arguments through to Jest, add a `--` separator —
`npm test -- tests/lib/web3.test.ts` or `npm test -- -t "some test name"`.

Jest runs only files under `tests/`. CI (`.github/workflows/test.yml`) runs
`npm ci` then `npm run test:coverage` on pull requests into `main` and
`develop` and posts a coverage comment; the e2e suite is local-only.

Playwright loads the unpacked extension from `build/debug/`, so build first
with `npm run debug:build`. It reads `PLAYWRIGHT_PIN_CODE` and
`PLAYWRIGHT_SEED_PHRASE` from `.env.debug` to drive wallet import (the PIN
must be at least 8 characters). An `ETHERSCAN_API_KEY` entry in `.env.debug`
unlocks the chains whose data provider needs a key (Monad, BSC, and their
testnets). Specs share one wallet session and run serially.
