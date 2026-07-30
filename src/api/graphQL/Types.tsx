/**
 * Types for the local API facades in this folder.
 *
 * This file used to mirror the retired backend's GraphQL schema. Everything that
 * described backend-only features — Karma/quests, referrals, automations, promo
 * codes, Cognito auth, gasless relaying, portfolio/meme alerts — has been removed
 * along with those features. Only the shapes still referenced by the wallet remain.
 */

/** A DEX aggregator quote, as returned by src/lib/swapproviders/*. */
export interface SwapQuotes {
    buyAmount: string;
    sellTokenAddress: string;
    buyTokenAddress: string;
    sellAmount: string;
    to: string;
    functionName: string;
    abi: string[];
    args: string[];
    value: string;
    price: number;
    guaranteedPrice: number;
    data: string;
    poweredBy: string;
    poweredByLogo: string;
    poweredByLogoLight: string;
    spender: string;
    swapVersion?: string;
    suggestedSlippage?: number;
    requiredSlippage?: number;
    gasEstimate: string;
}

/** Address-book entry; stored locally by ContactsController. */
export type Contact = {
    id?: string;
    name: string;
    walletAddress: string;
    ens?: string;
    avatar?: string;
};

/** A single call in a confirmation, used for fee estimation and EIP-5792 batches. */
export type AccountCallInput = {
    data: string;
    to: string;
    value: string;
};

/** On-chain price lookup result (src/lib/CoinsUtils). */
export type CoinLookupResult = {
    tokenAddress: string;
    usdPrice: number;
};
