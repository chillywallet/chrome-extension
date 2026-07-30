import WalletRequest from '../../../src/api/graphQL/WalletRequest';

const mockGetMarkets = jest.fn();
jest.mock('../../../src/lib/priceproviders/coingecko', () => ({
    getMarkets: (...args: any[]) => mockGetMarkets(...args),
}));

const mockGetSwapQuote = jest.fn();
const mockGetSwapTokenList = jest.fn();
jest.mock('../../../src/lib/swapproviders/openocean', () => ({
    getSwapQuote: (...args: any[]) => mockGetSwapQuote(...args),
    getSwapTokenList: (...args: any[]) => mockGetSwapTokenList(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockGetSwapTokenList.mockResolvedValue([]);
});

describe('WalletRequest (free-API facades)', () => {
    it('getCoinsByPlatformIds returns chain tokens carrying a real coinAddress', async () => {
        // Swap needs contract addresses: without coinAddress the Swap page resolves a
        // null token address and silently skips every quote.
        mockGetSwapTokenList.mockResolvedValue([
            { address: '0xAbC', symbol: 'USDC', name: 'USD Coin', decimals: 6, icon: 'i', usd: 1 },
        ]);

        const result = await WalletRequest.getCoinsByPlatformIds('', [143], 10, 0);

        expect(mockGetMarkets).not.toHaveBeenCalled();
        expect(result.data.platformCoins.data).toHaveLength(1);
        expect(result.data.platformCoins.data[0]).toMatchObject({
            coinAddress: '0xAbC',
            symbol: 'USDC',
            platformId: 143,
            coinId: '143:0xabc',
        });
    });

    it('getCoinsByPlatformIds filters chain tokens by the search term', async () => {
        mockGetSwapTokenList.mockResolvedValue([
            { address: '0x1', symbol: 'USDC', name: 'USD Coin', decimals: 6, icon: '', usd: 1 },
            { address: '0x2', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, icon: '', usd: 0 },
        ]);

        const result = await WalletRequest.getCoinsByPlatformIds('weth', [143], 10, 0);

        expect(result.data.platformCoins.data).toHaveLength(1);
        expect(result.data.platformCoins.data[0].symbol).toBe('WETH');
    });

    it('getCoinsByPlatformIds falls back to CoinGecko markets when no chain tokens exist', async () => {
        mockGetSwapTokenList.mockResolvedValue([]);
        mockGetMarkets.mockResolvedValue([{ coinId: 'cg:monad' }]);

        const result = await WalletRequest.getCoinsByPlatformIds('mon', [143], 10, 0);

        expect(mockGetMarkets).toHaveBeenCalledWith('mon', 10, 0);
        expect(result.data.platformCoins.data).toHaveLength(1);
        expect(result.data.platformCoins.pagination[0].page).toBe(1);
    });

    it('getSwapQuotes resolves the chain and wraps the aggregator quote', async () => {
        mockGetSwapQuote.mockResolvedValue({ to: '0xrouter', data: '0x1234' });

        const result = await WalletRequest.getSwapQuotes(
            '0xsell',
            '0xbuy',
            '1000',
            'monad',
            '0xme',
            '',
            1,
            0,
            true,
        );

        expect(mockGetSwapQuote).toHaveBeenCalledWith(
            expect.objectContaining({ chain_id: 143 }),
            expect.objectContaining({
                sellToken: '0xsell',
                buyToken: '0xbuy',
                sellAmountWei: '1000',
                walletAddress: '0xme',
                slippagePct: 1,
            }),
        );
        expect(result.data.getSwapQuotes).toEqual({ to: '0xrouter', data: '0x1234' });
    });

    it('getSwapQuotes rejects for unknown chains', async () => {
        await expect(
            WalletRequest.getSwapQuotes('0xs', '0xb', '1', 'nochain', '0xme', '', 1, 0, true),
        ).rejects.toThrow(/Unknown chain/);
    });
});
