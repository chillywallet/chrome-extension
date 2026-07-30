export enum EarnType {
    aPriori = 'aPriori',
    Kintsu = 'Kintsu',
    FastLane = 'FastLane',
    AgoraYield = 'AgoraYield',
    FastLaneYield = 'FastLaneYield',
    GauntletYield = 'GauntletYield',
    GauntletAlphaYield = 'GauntletAlphaYield',
}

export enum StakingType {
    Yield = 'Yield',
    Staking = 'Staking',
}

export type EarnCoin = {
    name: string;
    symbol: string;
    imageUrl: string;
    tokenAddress: string;
    decimals: number;
    coinId?: string;
};

export type EarnPartner = {
    name: string;
    imageUrl?: string;
    description?: string;
};

export type EarnListItem = {
    enabled: boolean;
    link?: string;
    name: string;
    imageUrl: string;
    platformId: number;
    stakingType: StakingType;
    tokenAddress: string;
    decimals: number;
    yieldApy?: number;
    vaultAddress?: string;
    vaultId?: string;
    partner_name?: string;
    partner?: EarnPartner;
    fromCoin?: EarnCoin;
    destinationCoin?: EarnCoin;
    //Deprecated
    toCoin?: EarnCoin;
    data: EarnItem[];
    showFastlanePoint?: boolean;
    announcementMessage?: string;
    message?: {
        depositTitle?: string;
        depositSubtitle?: string;
        withdrawTitle?: string;
        withdrawSubtitle?: string;
    };
};

export type EarnItem = {
    type: EarnType;
    name: string;
    description: string;
    platformId: number;
    fromCoin: EarnCoin;
    toCoin: EarnCoin;
    partner_name?: string;
    partner?: EarnPartner;
    requestsMerged: boolean;
    apr?: number;
    enabled?: boolean;
    link?: string;
};

export const EARN_PARTNERS: EarnPartner[] = [
    {
        name: 'FastLane',
        // No bundled logo; cards render without one (the wallet ships self-contained).
        imageUrl: '',
        description:
            'shMonad is the world’s first Holistic Liquid Staking Protocol, offering the best staking rewards exclusively on Monad.<br/><br/>Developed by FastLane Labs.',
    },
    {
        name: 'aPriori',
        imageUrl: '',
        description:
            'aPriori is the leading MEV-powered liquid staking platform on Monad. They provide a simple way for users to earn MEV-boosted rewards on their Monad tokens. Users that stake with aPriori can use liquid tokens on a range of DeFi applications to gain extra rewards.',
    },
    {
        name: 'Kintsu',
        imageUrl: require('../../assets/images/icon-kintsu.png'),
        description:
            'Kintsu is a Composable Liquid Staking Protocol. Their mission is to boost the GDP of Monad by allowing users to participate in on-chain activities while also benefitting from the yield-bearing staking that secures the blockchain. Kintsu solves a number of challenges faced by Proof-of-Stake blockchains around liquidity, accessibility, and more. No longer do on-chain protocols neeed to compete with L1 staking & security.',
    },
    {
        name: 'shMonad',
        imageUrl: '',
        description:
            'shMonad is the world’s first Holistic Liquid Staking Protocol, offering the best staking rewards exclusively on Monad.<br/><br/>Developed by FastLane Labs.',
    },
    {
        name: 'Gauntlet',
        imageUrl:
            'https://h6alaxyttgubqdfo.public.blob.vercel-storage.com/logo-gauntlet-EwYB1e6iRryeSfjQiawYmKHhZlfyHE.png',
        description:
            'Institutional-grade vaults for decentralized finance<br/><br/>Our vaults provide risk-adjusted DeFi yields for institutional capital at scale. These strategies are optimized by our automated risk platform — designed by the most vigilant, quantitative minds in crypto.<br /><br />We monitor market conditions to execute on growth opportunities and preserve self-custodial capital by minimizing downside exposure.',
    },
    {
        name: 'Agora',
        imageUrl:
            'https://h6alaxyttgubqdfo.public.blob.vercel-storage.com/logo-agora-VGwddrxMLsj64ZSRbUDdzlJpF4RHfs.png',
        description:
            'Money and Payments for Internet Markets<br/><br/>Agora powers the assets and infrastructure of digital finance. Run your business and move money at the speed of the internet.',
    },
    {
        name: 'Curvance',
        imageUrl:
            'https://h6alaxyttgubqdfo.public.blob.vercel-storage.com/cve-on-gradient-7AJwiCRXS0NxLMABuiY65ClHSOG8Sz.png',
        description:
            'Curvance makes DeFi lending more efficient, plain and simple. By enhancing the interaction between borrowers and lenders regarding collateral, liquidity, and yield, Curvance provides an alternative to legacy lending protocols that have stagnated in innovation.',
    },
];
