export const Images = {
    ledgerLogoOfficial: require('../../assets/images/ledger-logo-short.svg'),
    trezorLogoOfficial: require('../../assets/images/trezor-symbol-black-rgb.svg'),
    logoWalletWhite: require('../../assets/images/logo-chilly-white-text.png'),
    logoWalletWhiteNoText: require('../../assets/images/logo-chilly-white.png'),
    logoWalletColor: require('../../assets/images/logo-chilly-color-text.png'),
    logoColorText: require('../../assets/images/logo-chilly-color-text.png'),
    logoWhiteText: require('../../assets/images/logo-chilly-white-text.png'),
    logo128: require('../../assets/images/icon-chilly-classic.png'),
    coinMATIC: require('../../assets/images/ic_polygon.jpg'),
    coinETH: require('../../assets/images/ETH.png'),
    coinBase: require('../../assets/images/base.png'),
    coinBaseSepolia: require('../../assets/images/base_sepolia.png'),
    coinBNB: require('../../assets/images/BNB.png'),
    coinAVAX: require('../../assets/images/avalanche-avax-logo.png'),
    coinArbitrum: require('../../assets/images/arbitrum-arb-logo.png'),
    coinUSD: require('../../assets/images/USD.png'),
    iconSuccess: require('../../assets/images/icon-success.png'),
    iconError: require('../../assets/images/icon-error.png'),
    iconQuestion: require('../../assets/images/icon-question.png'),
    noResult: require('../../assets/images/icon-no-result.png'),
    spinner: require('../../assets/images/spinner.gif'),
    monadLogo: require('../../assets/images/monad_logo.png'),
    monadLogoWhite: require('../../assets/images/monad_logo_white.png'),
    monadLogoBlack: require('../../assets/images/monad_logo_black.png'),
    logoEtherscanLight: require('../../assets/images/logo-etherscan-light.png'),
    logoEtherscanDark: require('../../assets/images/logo-etherscan-dark.png'),
    logoOpenoceanLight: require('../../assets/images/logo-openocean-light.png'),
    logoOpenoceanDark: require('../../assets/images/logo-openocean-dark.png'),

    // Network badges for the wider EVM registry. Generated monogram marks, not
    // official logos — regenerate with `node scripts/render-chain-icons.js`.
    chainOptimism: require('../../assets/images/chain-optimism.png'),
    chainZksync: require('../../assets/images/chain-zksync.png'),
    chainScroll: require('../../assets/images/chain-scroll.png'),
    chainZora: require('../../assets/images/chain-zora.png'),
    chainMode: require('../../assets/images/chain-mode.png'),
    chainMetis: require('../../assets/images/chain-metis.png'),
    chainInk: require('../../assets/images/chain-ink.png'),
    chainSoneium: require('../../assets/images/chain-soneium.png'),
    chainLisk: require('../../assets/images/chain-lisk.png'),
    chainAurora: require('../../assets/images/chain-aurora.png'),
    chainGnosis: require('../../assets/images/chain-gnosis.png'),
    chainCelo: require('../../assets/images/chain-celo.png'),
    chainUnichain: require('../../assets/images/chain-unichain.png'),
    chainBob: require('../../assets/images/chain-bob.png'),
    chainDegen: require('../../assets/images/chain-degen.png'),
    chainPlume: require('../../assets/images/chain-plume.png'),
    chainTaiko: require('../../assets/images/chain-taiko.png'),
    chainWorldchain: require('../../assets/images/chain-worldchain.png'),
    chainLinea: require('../../assets/images/chain-linea.png'),
    chainBlast: require('../../assets/images/chain-blast.png'),
    chainMantle: require('../../assets/images/chain-mantle.png'),
    chainOpbnb: require('../../assets/images/chain-opbnb.png'),
    chainSonic: require('../../assets/images/chain-sonic.png'),
    chainBerachain: require('../../assets/images/chain-berachain.png'),
    chainSei: require('../../assets/images/chain-sei.png'),
    chainApechain: require('../../assets/images/chain-apechain.png'),
    chainHyperevm: require('../../assets/images/chain-hyperevm.png'),
    chainKatana: require('../../assets/images/chain-katana.png'),
    chainPlasma: require('../../assets/images/chain-plasma.png'),
    chainAbstract: require('../../assets/images/chain-abstract.png'),
    chainMoonbeam: require('../../assets/images/chain-moonbeam.png'),
    chainMoonriver: require('../../assets/images/chain-moonriver.png'),
    chainXdc: require('../../assets/images/chain-xdc.png'),
};

/**
 * App-icon finishes. `default` is Classic — the original flat silhouette, which is
 * also what the manifest ships — so it doubles as the fallback for any key that no
 * longer exists (e.g. an icon chosen before the rebrand). The other three use the
 * detailed penguin. Regenerate all of them with `node scripts/render-icons.js`.
 */
export const LAUNCHER_ICONS = [
    {
        key: 'default',
        name: 'Classic',
        path: require('../../assets/images/icon-chilly-classic.png'),
    },
    {
        key: 'frost',
        name: 'Frost',
        path: require('../../assets/images/icon-chilly-frost.png'),
    },
    {
        key: 'aurora',
        name: 'Aurora',
        path: require('../../assets/images/icon-chilly-aurora.png'),
    },
    {
        key: 'midnight',
        name: 'Midnight',
        path: require('../../assets/images/icon-chilly-midnight.png'),
    },
];

export const DEFAULT_LAUNCHER_ICON_KEY = 'default';
