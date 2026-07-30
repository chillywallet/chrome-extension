import { getCurrentChainByChain, getCurrentChainByChainId } from '../../lib/ChainsUtils';
import * as coingecko from '../../lib/priceproviders/coingecko';
import { getSwapQuote, getSwapTokenList } from '../../lib/swapproviders/openocean';
import { ChainConfig } from '../../config/types';

const WalletRequest = {
    /**
     * Coin listing scoped to a chain, wrapped in the legacy `platformCoins` envelope.
     *
     * Every caller of this is a swap coin selector, so the entries MUST carry a real
     * contract address: getSwapTokenAddress returns null without `coinAddress`, and the
     * Swap page then skips the quote silently (no request, "Price N/A"). CoinGecko's
     * market list has no per-chain addresses, so it is only the fallback for chains with
     * no swap provider.
     */
    async getCoinsByPlatformIds(
        name: string,
        platformIds: number[],
        limit: number,
        offset: number,
    ) {
        const page = Math.floor(offset / Math.max(limit, 1)) + 1;
        const chainId = platformIds?.[0];
        const chain = chainId ? (getCurrentChainByChainId(chainId) as ChainConfig | undefined) : undefined;

        const envelope = (data: any[]) => ({
            data: {
                platformCoins: {
                    data,
                    pagination: [{ page, last: data.length >= limit ? page + 1 : page }],
                },
            },
        });

        if (chain?.swapProvider?.kind === 'openocean') {
            const tokens = await getSwapTokenList(chain);

            if (tokens.length) {
                const query = name.trim().toLowerCase();
                const filtered = query
                    ? tokens.filter(
                          token =>
                              token.symbol.toLowerCase().includes(query) ||
                              token.name.toLowerCase().includes(query),
                      )
                    : tokens;

                // The endpoint returns the whole list; page it here to keep the
                // legacy paging contract intact.
                const paged = filtered.slice(offset, offset + limit).map((token, index) => ({
                    id: offset + index + 1,
                    coinId: `${chain.chain_id}:${token.address.toLowerCase()}`,
                    name: token.name,
                    symbol: token.symbol,
                    description: '',
                    logo: token.icon,
                    logo_lrg: token.icon,
                    rank: offset + index + 1,
                    max_supply: 0,
                    platformId: chain.chain_id,
                    coinAddress: token.address,
                    decimals: token.decimals,
                    is_verified: true,
                    latest: {
                        price: token.usd,
                        fully_diluted_market_cap: 0,
                        percent_change_7d: 0,
                        percent_change_24h: 0,
                        percent_change_30d: 0,
                        volume_24h: 0,
                    },
                }));

                return envelope(paged);
            }
        }

        return envelope(await coingecko.getMarkets(name, limit, offset));
    },

    /**
     * Swap quotes now come from the configured DEX aggregator (OpenOcean by
     * default, see src/config/chains.ts) wrapped in the legacy envelope.
     */
    async getSwapQuotes(
        sellToken: string,
        buyToken: string,
        sellAmount: string,
        chain: string,
        walletAddress: string,
        _partner: string,
        slippagePercentage: number,
        _retryTimes: number,
        _showError: boolean,
    ) {
        const chainConfig = getCurrentChainByChain(chain as any) as ChainConfig | undefined;

        if (!chainConfig) {
            throw new Error(`Unknown chain: ${chain}`);
        }

        const quote = await getSwapQuote(chainConfig, {
            sellToken,
            buyToken,
            sellAmountWei: sellAmount,
            walletAddress,
            slippagePct: slippagePercentage,
        });

        return { data: { getSwapQuotes: quote } };
    },

};

export default WalletRequest;
