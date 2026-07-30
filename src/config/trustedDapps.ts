/**
 * Curated dapp directory for the in-wallet search screen.
 *
 * Committed locally (previously fetched from the retired backend's
 * trusted-domains endpoint) so the wallet stays fully self-contained.
 * Extend by adding entries here; `level: 'SCAM'` entries are filtered
 * out by the search screen and exist only so imported lists keep shape.
 */
export type TrustedDapp = {
    url: string;
    name: string;
    description: string;
    level: 'HIGH' | 'SCAM';
};

export const TRUSTED_DAPPS: TrustedDapp[] = [
    { url: 'https://app.uniswap.org', name: 'Uniswap', description: 'Swap tokens on the leading DEX', level: 'HIGH' },
    { url: 'https://opensea.io', name: 'OpenSea', description: 'NFT marketplace', level: 'HIGH' },
    { url: 'https://app.aave.com', name: 'Aave', description: 'Lending and borrowing', level: 'HIGH' },
    { url: 'https://curve.finance', name: 'Curve', description: 'Stablecoin-focused DEX', level: 'HIGH' },
    { url: 'https://lido.fi', name: 'Lido', description: 'Liquid staking for Ethereum', level: 'HIGH' },
    { url: 'https://app.1inch.io', name: '1inch', description: 'DEX aggregator', level: 'HIGH' },
    { url: 'https://blur.io', name: 'Blur', description: 'Pro NFT marketplace', level: 'HIGH' },
    { url: 'https://app.compound.finance', name: 'Compound', description: 'Lending protocol', level: 'HIGH' },
    { url: 'https://app.ens.domains', name: 'ENS', description: 'Ethereum Name Service', level: 'HIGH' },
    { url: 'https://www.nad.domains', name: 'Nad Domains', description: 'Name service on Monad', level: 'HIGH' },
    { url: 'https://stake.apr.io', name: 'aPriori', description: 'MEV-powered liquid staking on Monad', level: 'HIGH' },
    { url: 'https://kintsu.xyz', name: 'Kintsu', description: 'Composable liquid staking on Monad', level: 'HIGH' },
];
