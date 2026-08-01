# Chilly Wallet — Privacy Policy

**Last updated: 1 August 2026**

Chilly Wallet is a self-custodial crypto wallet that runs entirely inside your browser. It has no
backend of its own: there is no Chilly account, no login, no sync service, and no server operated by
us that your wallet talks to.

## What we collect

**Nothing.** We do not operate a server, so there is no system on our side that receives, stores, or
processes your data. The extension contains no analytics, telemetry, crash reporting, advertising, or
tracking code of any kind.

We cannot see your funds, your addresses, your transactions, or your activity.

## What stays on your device

All of the following is held in your browser's local extension storage and never leaves your machine:

- Your recovery phrase and private keys, encrypted with your PIN
- Your PIN
- Account names, address book contacts, and favourites
- Settings, including any API keys you choose to enter
- Cached balances, prices, and transaction history

Your recovery phrase and private keys are never transmitted anywhere, by any code path, for any
reason. Anyone with access to your unlocked device or your recovery phrase can spend your funds — we
cannot recover, freeze, or reverse anything.

## What the extension sends to third parties

A blockchain wallet cannot work without reading from the network. When you use the wallet, it queries
public blockchain infrastructure directly from your browser. These are independent services with
their own privacy policies, and we have no relationship with them and receive nothing from them.

| Purpose | Services contacted | What they can see |
| --- | --- | --- |
| Balances, transaction history, NFTs | Blockscout instances, Etherscan V2, Routescan, BlockVision (optional) | Your wallet address, your IP address |
| Token and coin prices, charts | DefiLlama, CoinGecko | Token/coin identifiers, your IP address |
| Swap quotes and swap calldata | OpenOcean | The addresses and amounts being swapped, your wallet address, your IP address |
| Sending transactions, reading chain state | The public RPC endpoint configured for each network | Your wallet address, transaction contents, your IP address |
| Name resolution (`.nad` and similar) | nad.domains, the Monad RPC endpoint | The name or address being resolved, your IP address |

As with any request your browser makes, these services can observe your IP address. If that concerns
you, use the wallet behind a VPN or configure your own RPC endpoints in Settings.

Requests are made only for the network you have selected and for the accounts in your wallet.

## Websites you visit

To let websites offer "Connect Wallet", the extension injects a small provider script into pages you
visit. This is how every browser wallet works.

- The script only exposes a connection interface. It does not read page content, form fields, or
  browsing history, and it does not report which sites you visit to anyone.
- A website cannot see your addresses until you explicitly approve a connection, and can only see the
  accounts you approve.
- A website can never initiate a transaction or signature without an approval prompt that you confirm.
- You can revoke a site's access at any time in Settings.

The bundled phishing detector compares the site you are on against a locally bundled list of known
malicious domains. The comparison happens on your device; no browsing data is sent anywhere.

## Optional API keys

Some data providers offer a free API key for higher rate limits. If you enter one under Developer
Settings, it is stored locally and sent only to the provider it belongs to, as part of the requests
described above. It is never sent to us or to anyone else.

## Children

Chilly Wallet is not directed at children under 13.

## Changes

If this policy changes, the "last updated" date above changes with it and the revised policy ships in
a subsequent release. The current version is always the one in this repository.

## Contact

Questions about this policy can be raised as an issue on the project's GitHub repository.
