# Chrome Web Store submission

Everything the Developer Dashboard asks for, kept in the repo so a resubmission does not mean
rewriting it from memory. Copy the fields below into the listing; the checklist at the end covers the
parts that cannot be prepared here.

Build the upload with:

```bash
npm run release
```

That runs the production build and then `scripts/verify-package.js`, which fails the release if the
manifest points at a missing file, still carries a `key`, ships source maps, or disagrees with
`package.json` on the version. The artifact lands in `build/` as
`chilly-extension-prod-<timestamp>.zip`, with `manifest.json` at the archive root as the store
requires.

---

## Store listing

**Name** — `Chilly Wallet`

**Summary** (132 char limit, must match the manifest description)

```
A cool multi-chain crypto wallet. Self-contained, backend-free, and open: your keys never leave your device.
```

**Category** — Productivity

**Language** — English (United States)

### Description

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

---

## Privacy tab

**Single purpose**

```
Chilly Wallet is a self-custodial cryptocurrency wallet. It stores the user's keys locally, shows
their balances and transaction history across EVM networks, and lets them sign and send transactions,
including to websites that request a wallet connection.
```

**Privacy policy URL** — host `PRIVACY.md` at a public URL and paste it here. GitHub Pages, or the
raw file rendered on the repository, both qualify. This field is mandatory and cannot be left empty.

### Permission justifications

Paste each verbatim against the matching permission.

| Permission | Justification |
| --- | --- |
| `storage` | Stores the encrypted wallet vault, accounts, contacts and settings on the user's device. The wallet has no backend, so this is the only place its state exists. |
| `unlimitedStorage` | Cached balances, transaction history and NFT metadata across 40 networks exceed the default quota for a wallet holding many assets. |
| `offscreen` | Ledger and Trezor support needs WebHID and an iframe, neither of which is available in an MV3 service worker. The offscreen document hosts those bridges. |
| `sidePanel` | The wallet can be opened in Chrome's side panel so it stays visible next to a dapp instead of closing when the popup loses focus. |
| `activeTab` | Used to identify the tab a connection or signature request came from, so the confirmation prompt can show the user which site is asking. |
| `clipboardWrite` | Copies addresses, transaction hashes and the recovery phrase to the clipboard on an explicit user action. |
| `webNavigation` | Detects navigation in order to run the bundled phishing check against a locally shipped domain list, and to re-establish the provider connection after the MV3 service worker restarts. |
| Host permissions (`http://*/*`, `https://*/*`, `file://*/*`) | A wallet cannot know in advance which sites a user will connect to, so the provider script must be available on any page. The script only exposes the EIP-1193 connection interface; it does not read page content, and a site sees nothing until the user approves a connection. |
| Remote code | None. Everything executed ships inside the package. The CSP is `script-src 'self' 'wasm-unsafe-eval'`. |

### Data usage disclosures

Declare **no** collection for every category. The extension has no server and no analytics, so
nothing is collected, transmitted to us, sold, or used for anything beyond the single purpose above.

Note in the justification box that the wallet queries third-party public APIs (block explorers, price
feeds, a swap aggregator, RPC nodes) directly from the user's browser, that those services can see a
wallet address and IP address inherently, and that this is disclosed in the privacy policy.

Then affirm the three certifications: data is not sold to third parties, is not used for purposes
unrelated to the single purpose, and is not used to determine creditworthiness or for lending.

---

## Graphical assets

These have to be produced from a running build — they are screenshots and artwork, not something the
repo can generate. Sizes are the store's requirements.

| Asset | Size | Required | Notes |
| --- | --- | --- | --- |
| Store icon | 128×128 PNG | yes | `extension/images/icon-128.png` already ships at this size |
| Screenshots | 1280×800 or 640×400 PNG | yes, at least 1 (up to 5) | Suggested: Home with balances, a coin detail chart, the swap screen, a dapp connection prompt, Settings |
| Small promo tile | 440×280 PNG | only if featured | |
| Marquee promo tile | 1400×560 PNG | no | |

Screenshots must show the actual extension UI. Avoid real balances and real addresses — set up a
demo wallet first. `e2e/` drives the built extension through Playwright and is the easiest way to get
clean, repeatable captures at a fixed viewport.

---

## Before submitting

- [ ] Decide the release version. `package.json` and both manifests are currently `1.7.0`; bump all
      three together if this release should carry a new number.
- [ ] `npm run release` passes.
- [ ] Load `build/prod/` unpacked in Chrome and confirm onboarding, send, swap and a dapp connection
      all work in a build with no `key` in the manifest — the extension id differs from the one the
      development builds use, so anything that assumed the old id will surface here.
- [ ] Privacy policy hosted, URL pasted into the dashboard.
- [ ] Screenshots captured.
- [ ] A test account is available for reviewers. Google's reviewers must be able to exercise the
      wallet; include a funded testnet recovery phrase in "Notes for reviewers", never a mainnet one.
- [ ] In "Notes for reviewers", state that the extension is self-custodial, has no backend, and that
      the broad host permissions exist solely to expose the wallet connection interface to dapps.

Expect extra review time. Crypto wallets attract manual review, and broad host permissions plus a
single-purpose financial product is exactly the combination that gets one.
