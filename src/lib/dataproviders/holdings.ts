import { ChainConfig } from '../../config/types';
import { CoinHolding } from '../../shared/types/Wallet';
import { RawTokenBalance, syntheticCoinId } from './types';

/** Builds the CoinHolding entry for the chain's native coin. */
export function buildNativeHolding(
    chain: ChainConfig,
    walletAddress: string,
    balance: number,
): CoinHolding {
    return {
        wallet_address: walletAddress.toLowerCase(),
        wallet_name: '',
        token_id: syntheticCoinId(chain.chain_id, chain.native_coin_address),
        token_address: chain.native_coin_address,
        balance,
        balance_usd: 0,
        platform_id: chain.platform_id,
        integration_type: 'wallet',
        avatar: null,
        coin_name: chain.native_coin_name,
        logo: chain.icon,
        symbol: chain.native_coin_symbol,
        is_custom: false,
        is_hidden: null,
        is_verified: true,
    };
}

/** Builds a CoinHolding from a normalized ERC-20 balance. */
export function buildTokenHolding(
    chain: ChainConfig,
    walletAddress: string,
    token: RawTokenBalance,
): CoinHolding {
    return {
        wallet_address: walletAddress.toLowerCase(),
        wallet_name: '',
        token_id: syntheticCoinId(chain.chain_id, token.tokenAddress),
        token_address: token.tokenAddress.toLowerCase(),
        balance: token.balance,
        balance_usd: 0,
        platform_id: chain.platform_id,
        integration_type: 'wallet',
        avatar: null,
        coin_name: token.name || token.symbol,
        logo: token.logo ?? '',
        symbol: token.symbol,
        is_custom: false,
        is_hidden: null,
        is_verified: Boolean(token.verified),
    };
}
