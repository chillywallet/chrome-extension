import { SwapQuotes } from '../../api/graphQL/Types';
import { ChainConfig } from '../../config/types';
import logger from '../../shared/utils/logger';
import { RateLimiters, createRateLimiter } from '../../shared/utils/rateLimiter';
import { fetchJson } from '../dataproviders/http';
import { makeProvider } from '../rpcProvider';

/**
 * OpenOcean v4 aggregator adapter (free, no API key).
 * https://open-api.openocean.finance/v4/{chain}/swap
 *
 * Returns ready-to-send calldata that the existing TransactionController path
 * submits as a raw {to, data, value} transaction. OpenOcean uses the same
 * 0xeeee…eeee sentinel for native coins as this wallet.
 */

const BASE_URL = 'https://open-api.openocean.finance/v4';

const limiter =
    (RateLimiters as any).openocean ??
    ((RateLimiters as any).openocean = createRateLimiter('OpenOcean', {
        maxCalls: 2,
        intervalMs: 1000,
        maxConcurrent: 2,
        maxQueueLength: 30,
        maxQueueWaitMs: 20000,
        queueWarningThreshold: 15,
    }));

export type SwapQuoteParams = {
    sellToken: string;
    buyToken: string;
    /** Sell amount in wei (base units). */
    sellAmountWei: string;
    walletAddress: string;
    /** Slippage percentage, e.g. 1 = 1%. */
    slippagePct: number;
};

export async function getSwapQuote(
    chain: ChainConfig,
    params: SwapQuoteParams,
): Promise<SwapQuotes> {
    const slug = chain.swapProvider.providerChainSlug;

    if (chain.swapProvider.kind !== 'openocean' || !slug) {
        throw new Error(`Swap is not supported on ${chain.name}`);
    }

    // OpenOcean requires the gas price in wei.
    let gasPriceWei = 10n ** 9n; // 1 gwei fallback
    try {
        const feeData = await makeProvider(chain.chain_id).getFeeData();
        gasPriceWei = feeData.gasPrice ?? feeData.maxFeePerGas ?? gasPriceWei;
    } catch (error) {
        logger.log('🔄 OpenOcean: gas price lookup failed, using fallback', error);
    }

    const search = new URLSearchParams({
        inTokenAddress: params.sellToken,
        outTokenAddress: params.buyToken,
        amountDecimals: params.sellAmountWei,
        gasPriceDecimals: gasPriceWei.toString(),
        slippage: String(params.slippagePct),
        account: params.walletAddress,
    });

    const payload = await fetchJson(limiter, `${BASE_URL}/${slug}/swap?${search}`);

    if (payload?.code !== 200 || !payload?.data) {
        throw new Error(payload?.error ?? payload?.message ?? 'Failed to fetch swap quote');
    }

    const data = payload.data;
    const inDecimals = Number(data?.inToken?.decimals ?? 18);
    const outDecimals = Number(data?.outToken?.decimals ?? 18);
    const inAmount = Number(data?.inAmount ?? params.sellAmountWei) / 10 ** inDecimals;
    const outAmount = Number(data?.outAmount ?? 0) / 10 ** outDecimals;
    const minOutAmount = Number(data?.minOutAmount ?? data?.outAmount ?? 0) / 10 ** outDecimals;
    const price = inAmount > 0 ? outAmount / inAmount : 0;
    const guaranteedPrice = inAmount > 0 ? minOutAmount / inAmount : 0;

    return {
        buyAmount: String(data?.outAmount ?? '0'),
        sellTokenAddress: params.sellToken,
        buyTokenAddress: params.buyToken,
        sellAmount: String(data?.inAmount ?? params.sellAmountWei),
        to: data?.to ?? '',
        functionName: '',
        abi: [],
        args: [],
        value: String(data?.value ?? '0'),
        price,
        guaranteedPrice,
        data: data?.data ?? '',
        poweredBy: 'OpenOcean',
        poweredByLogo: '',
        poweredByLogoLight: '',
        spender: data?.to ?? '',
        swapVersion: '2',
        gasEstimate: String(data?.estimatedGas ?? '0'),
    };
}

/** A tradable token on a chain, as returned by OpenOcean's token list. */
export type SwapToken = {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    icon: string;
    usd: number;
};

/**
 * The chain's tradable token list (free, no key).
 *
 * This is the only source of per-chain token *addresses* available without a
 * backend — CoinGecko's market list carries no contract addresses, so tokens
 * picked from it can't be swapped (getSwapTokenAddress returns null and the
 * quote is silently skipped).
 */
export async function getSwapTokenList(chain: ChainConfig): Promise<SwapToken[]> {
    const slug = chain.swapProvider.providerChainSlug;

    if (chain.swapProvider.kind !== 'openocean' || !slug) {
        return [];
    }

    try {
        const payload = await fetchJson(limiter, `${BASE_URL}/${slug}/tokenList`);

        if (payload?.code !== 200 || !Array.isArray(payload?.data)) {
            return [];
        }

        return payload.data
            .filter((entry: any) => entry?.address && entry?.symbol)
            .map((entry: any) => ({
                address: String(entry.address),
                symbol: String(entry.symbol).toUpperCase(),
                name: String(entry.name ?? entry.symbol),
                decimals: Number(entry.decimals ?? 18),
                icon: String(entry.icon ?? ''),
                usd: Number(entry.usd ?? 0),
            }));
    } catch (error) {
        logger.log('🔄 OpenOcean: token list unavailable', error);
        return [];
    }
}
