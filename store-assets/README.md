# Store draft — ready to paste

Everything the Chrome Web Store listing needs for **Chilly Wallet 1.0.0**, in the order the
Developer Dashboard asks for it. Each fenced block is meant to be copied verbatim.

The package itself comes from `npm run release`, which builds and then verifies it. Upload
`build/chilly-extension-prod-<timestamp>.zip`.

Screenshots are in `screenshots/`, already at the required 1280×800. Regenerate them with
`node scripts/render-store-screenshots.js` (needs `npm run debug:build` first).

## Automating it

`listing.json` holds the same field values in machine-readable form, and is what the automation
reads — **edit it first**, then mirror any change into the blocks below.

```bash
npm run store:login    # you sign in by hand, once
npm run release        # build and verify the package
npm run store:draft    # uploads the package and screenshots, fills the listing
```

`store:login` opens the dashboard in a dedicated Chrome profile at `.store-profile/` and waits
while you sign in. It never types a password — it only watches for the dashboard to appear, then
saves the profile so `store:draft` can reuse the session. The profile holds live Google cookies and
is gitignored.

Two things worth knowing:

- **This works where a browser extension cannot.** Chrome blocks extensions from scripting the Web
  Store gallery outright; Playwright drives the browser over CDP, which that restriction does not
  cover. It launches your real Chrome (`channel: 'chrome'`) rather than bundled Chromium, because
  Google is far more willing to complete a sign-in there.
- **`store:draft` stops at "save draft" and never submits for review.** Publishing is a decision,
  not a build step. Watch the first run: the dashboard is an unversioned Google app whose DOM shifts
  without notice, so any step that cannot find its target writes a screenshot and the page HTML to
  `store-assets/debug/` and stops rather than clicking the wrong thing.

Pass `--item <id>` (or set `CWS_ITEM_ID`) to edit an existing listing instead of creating a new one.

---

## 1. Package

Upload the zip from `build/`. It contains `manifest.json` at the archive root and no `key`, so the
store assigns the extension id.

> **The extension id will differ from your development builds**, which pin an id via the manifest
> `key`. Load `build/prod/` unpacked once and click through onboarding, send, swap and a dapp
> connection before uploading.

## 2. Store listing tab

**Name**

```
Chilly Wallet
```

**Summary** — 132 char limit; matches the manifest description exactly

```
A cool multi-chain crypto wallet. Self-contained, backend-free, and open: your keys never leave your device.
```

**Description**

```
Chilly Wallet is a self-custodial crypto wallet for the EVM ecosystem, built to stay out of your way.

Your keys never leave your device. There is no Chilly account, no login, and no server of ours behind
the wallet — the extension talks to public blockchain infrastructure directly from your browser.

40 EVM networks, one wallet
Ethereum, Base, Polygon, Arbitrum, Optimism, BNB Chain, Avalanche, ZKsync Era, Scroll, Linea, Blast,
Zora, Mode, Metis, Ink, Soneium, Lisk, Aurora, Gnosis, Celo, Unichain, BOB, Degen, Plume, Taiko,
World Chain, Mantle, opBNB, Sonic, Berachain, Sei, ApeChain, HyperEVM, Katana, Plasma, Abstract,
Moonbeam, Moonriver, XDC and Monad — plus test networks for development.

What you can do
• Hold, send and receive tokens and NFTs across every supported network
• Swap tokens through an on-chain aggregator, on the networks that support it
• Connect to any dapp that speaks EIP-1193, with per-site permissions you can revoke
• Track prices and portfolio value, with charts per coin
• Stake into liquid staking protocols on Monad
• Use a Ledger or Trezor for hardware-backed accounts
• Resolve human-readable names instead of pasting hex addresses
• Work from the popup or the Chrome side panel, whichever suits you

Built to be inspected
No analytics. No telemetry. No ads. No tracking. No remote code — everything that runs is in the
package you install. The source is open, so none of this has to be taken on trust.

Self-custody means you are responsible for your recovery phrase. Write it down and keep it offline:
if you lose it, nobody — including us — can restore your funds.
```

**Category** — Productivity  **Language** — English (United States)

### Graphical assets

| Field | File |
| --- | --- |
| Store icon 128×128 | `extension/images/icon-128.png` |
| Screenshot 1 | `screenshots/01-home.png` — portfolio and token list |
| Screenshot 2 | `screenshots/02-coin-detail.png` — price chart and market stats |
| Screenshot 3 | `screenshots/03-swap.png` — a live swap quote |
| Screenshot 4 | `screenshots/04-activity.png` — history grouped by day |
| Screenshot 5 | `screenshots/05-networks.png` — the network picker |

Promo tiles (440×280, 1400×560) are optional and only matter for featuring. Not included.

## 3. Privacy tab

**Single purpose**

```
Chilly Wallet is a self-custodial cryptocurrency wallet. It stores the user's keys locally, shows
their balances and transaction history across EVM networks, and lets them sign and send transactions,
including to websites that request a wallet connection.
```

**Privacy policy URL** — mandatory. Host `PRIVACY.md` publicly and paste the URL.

**Permission justifications** — one per declared permission

```
storage
Stores the encrypted wallet vault, accounts, contacts and settings on the user's device. The wallet
has no backend, so this is the only place its state exists.
```

```
unlimitedStorage
Cached balances, transaction history and NFT metadata across 40 networks exceed the default quota for
a wallet holding many assets.
```

```
offscreen
Ledger and Trezor support needs WebHID and an iframe, neither of which is available in an MV3 service
worker. The offscreen document hosts those bridges.
```

```
sidePanel
The wallet can be opened in Chrome's side panel so it stays visible next to a dapp instead of closing
when the popup loses focus.
```

```
activeTab
Used to identify the tab a connection or signature request came from, so the confirmation prompt can
show the user which site is asking.
```

```
clipboardWrite
Copies addresses, transaction hashes and the recovery phrase to the clipboard on an explicit user
action.
```

```
webNavigation
Detects navigation in order to run the bundled phishing check against a locally shipped domain list,
and to re-establish the provider connection after the MV3 service worker restarts.
```

```
Host permissions (http://*/*, https://*/*, file://*/*)
A wallet cannot know in advance which sites a user will connect to, so the provider script must be
available on any page. The script only exposes the EIP-1193 connection interface; it does not read
page content, and a site sees nothing until the user approves a connection.
```

```
Remote code
None. Everything executed ships inside the package. The CSP is script-src 'self' 'wasm-unsafe-eval'.
```

**Data usage** — declare **no collection** for every category, then tick the three certifications
(not sold to third parties, not used beyond the single purpose, not used for creditworthiness).

In the justification box:

```
The extension has no backend and contains no analytics or telemetry. It queries third-party public
APIs — block explorers, price feeds, a swap aggregator and RPC nodes — directly from the user's
browser. Those services can observe a wallet address and IP address as an inherent property of the
request. This is disclosed in the privacy policy.
```

## 4. Notes for reviewers

```
Chilly Wallet is a self-custodial EVM wallet. There is no backend, no account and no login — the
extension talks to public blockchain APIs directly from the browser.

The broad host permissions exist solely so the EIP-1193 provider script can be exposed on any page a
user might connect a dapp from. The script reads no page content, and a site receives nothing until
the user explicitly approves a connection.

To exercise the wallet, import this testnet recovery phrase during onboarding and set any PIN:
<PASTE A FUNDED TESTNET SEED PHRASE HERE — NEVER A MAINNET ONE>
```

---

## Before you submit

- [ ] `npm run release` passes and you are uploading the zip it produced
- [ ] `build/prod/` smoke-tested unpacked, since the extension id changes
- [ ] Privacy policy hosted, URL pasted
- [ ] Testnet seed phrase pasted into the reviewer notes above
- [ ] Version is intentional — `1.0.0` in `package.json` and both manifests

Expect manual review. A crypto wallet with broad host permissions reliably draws one, and it takes
longer than the usual few days.
