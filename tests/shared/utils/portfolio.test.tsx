import {
    getCoinHoldings,
    getNftHoldings,
    getTokenTransactionHistory,
    getTransactionHistory,
    getTransactionName,
    importPortfolioWallet,
} from '../../../src/shared/utils/portfolio';
import EventType from '../../../src/shared/types/EventType';

const mockGetTokenHoldings = jest.fn();
const mockGetTransactions = jest.fn();
const mockGetNFTs = jest.fn();

jest.mock('../../../src/lib/dataproviders', () => ({
    getDataProvider: () => ({
        getTokenHoldings: (...args: any[]) => mockGetTokenHoldings(...args),
        getTransactions: (...args: any[]) => mockGetTransactions(...args),
        getNFTs: (...args: any[]) => mockGetNFTs(...args),
    }),
    MissingApiKeyError: class MissingApiKeyError extends Error {},
}));

const mockCustomTokens = jest.fn();
const mockIsHidden = jest.fn();
jest.mock('../../../src/lib/customTokens', () => ({
    getCustomTokens: (...args: any[]) => mockCustomTokens(...args),
    isTokenHidden: (...args: any[]) => mockIsHidden(...args),
}));

jest.mock('../../../src/lib/CoinsUtils', () => ({
    __esModule: true,
    default: {
        updateCoinAssets: (assets: any, cb: (a: any) => void) => cb(assets),
    },
}));

const mockState: any = {
    globalState: {
        internalAccounts: { accounts: {} },
        unknownCoinIds: [],
        cachingCoins: [],
    },
};

jest.mock('../../../src/store/store', () => ({
    getReduxStore: () => ({
        getState: () => mockState,
        dispatch: jest.fn(),
    }),
}));

jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showError: jest.fn(), showSuccess: jest.fn() },
}));

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const WALLET = '0x1111111111111111111111111111111111111111';
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const TOKEN = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function holding(over: Partial<any> = {}) {
    return {
        wallet_address: WALLET,
        wallet_name: '',
        token_id: `143:${over.token_address ?? TOKEN}`,
        token_address: TOKEN,
        balance: 1,
        balance_usd: 0,
        platform_id: 143,
        integration_type: 'wallet',
        avatar: null,
        coin_name: 'Token A',
        logo: '',
        symbol: 'TKA',
        is_custom: false,
        is_hidden: null,
        is_verified: false,
        ...over,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockCustomTokens.mockReturnValue([]);
    mockIsHidden.mockReturnValue(false);
    mockState.globalState.internalAccounts.accounts = {
        a1: { address: WALLET, metadata: { name: 'Account 1', avatar: '🦊' } },
    };
});

describe('getCoinHoldings (provider-driven)', () => {
    it('groups provider holdings and puts the native coin first', async () => {
        mockGetTokenHoldings.mockResolvedValue([
            holding(),
            holding({
                token_address: NATIVE,
                token_id: `143:${NATIVE}`,
                symbol: 'MON',
                coin_name: 'Monad',
                balance: 2,
            }),
        ]);

        const result = await getCoinHoldings(WALLET, false, 143);

        expect(mockGetTokenHoldings).toHaveBeenCalledWith(WALLET);
        expect(result.empty).toBe(false);
        expect(result.assets.groupByCoins[0].token_address).toBe(NATIVE);
        expect(result.assets.groupByCoins).toHaveLength(2);
        // avatar + wallet name from local account
        expect(result.assets.groupByCoins[0].avatar).toBe('🦊');
        expect(result.wallets[0]).toEqual({ walletAddress: WALLET, walletName: 'Account 1' });
    });

    it('fetches all local accounts when no address is given', async () => {
        mockState.globalState.internalAccounts.accounts = {
            a1: { address: WALLET, metadata: { name: 'A' } },
            a2: { address: '0x2222222222222222222222222222222222222222', metadata: { name: 'B' } },
            deleted: { address: '0x3', metadata: { name: 'X', deleted: true } },
        };
        mockGetTokenHoldings.mockResolvedValue([]);

        await getCoinHoldings('', false, 143);

        expect(mockGetTokenHoldings).toHaveBeenCalledTimes(2);
    });

    it('merges locally added custom tokens', async () => {
        mockGetTokenHoldings.mockResolvedValue([]);
        mockCustomTokens.mockReturnValue([
            { address: '0xcustom', name: 'Custom', symbol: 'CST', decimals: 18 },
        ]);

        const result = await getCoinHoldings(WALLET, false, 143);

        const custom = result.assets.groupByCoins.find(
            (coin: any) => coin.token_address === '0xcustom',
        );
        expect(custom).toBeDefined();
        expect(custom.is_custom).toBe(true);
    });

    it('applies local hidden flags and honors showHidden=false', async () => {
        mockGetTokenHoldings.mockResolvedValue([holding()]);
        mockIsHidden.mockReturnValue(true);

        const shown = await getCoinHoldings(WALLET, false, 143, true, true);
        expect(shown.assets.groupByCoins[0].is_hidden).toBe(true);

        const filtered = await getCoinHoldings(WALLET, false, 143, true, false);
        expect(filtered.empty).toBe(true);
    });

    it('resolves empty on provider failure', async () => {
        mockGetTokenHoldings.mockRejectedValue(new Error('down'));

        const result = await getCoinHoldings(WALLET, false, 143);
        expect(result.empty).toBe(true);
    });
});

describe('transaction history (provider-driven)', () => {
    it('maps tokens through handleTransactionTokens', async () => {
        mockGetTransactions.mockResolvedValue({
            data: [
                {
                    _id: '0xh',
                    tokens: [
                        { token_id: 't1', in: true, value: '1', usd_value: 0, is_nft: false },
                        { token_id: 't1', in: true, value: '2', usd_value: 0, is_nft: false },
                    ],
                },
            ],
            pagination: { page: 1, hasNextPage: false },
        });

        const result = await getTransactionHistory(WALLET, 143, 1);

        expect(mockGetTransactions).toHaveBeenCalledWith(WALLET, 1, 10);
        expect(result.data[0].tokens).toHaveLength(1); // duplicates collapsed
        expect(result.data[0].tokens[0].value).toBe(3);
    });

    it('forwards the token filter for per-coin history', async () => {
        mockGetTransactions.mockResolvedValue({
            data: [],
            pagination: { page: 1, hasNextPage: false },
        });

        await getTokenTransactionHistory(WALLET, 143, TOKEN, 2);
        expect(mockGetTransactions).toHaveBeenCalledWith(WALLET, 2, 10, TOKEN);
    });

    it('returns an empty page on provider failure', async () => {
        mockGetTransactions.mockRejectedValue(new Error('down'));
        const result = await getTransactionHistory(WALLET, 143, 1);
        expect(result.data).toHaveLength(0);
        expect(result.pagination.hasNextPage).toBe(false);
    });
});

describe('getNftHoldings (provider-driven)', () => {
    it('passes search and pagination to the provider', async () => {
        mockGetNFTs.mockResolvedValue({ nfts: [], pagination: null });

        await getNftHoldings(WALLET, 143, 'cats', 3);
        expect(mockGetNFTs).toHaveBeenCalledWith(WALLET, 'cats', 3, expect.any(Number));
    });

    it('returns empty on provider failure', async () => {
        mockGetNFTs.mockRejectedValue(new Error('down'));
        const result = await getNftHoldings(WALLET, 143);
        expect(result).toEqual({ nfts: [], pagination: null });
    });
});

describe('importPortfolioWallet (local no-op)', () => {
    it('reports success immediately and asks the UI to refresh', () => {
        const eventManager = require('../../../src/shared/utils/eventManager').default;
        const emitSpy = jest.spyOn(eventManager, 'emit').mockImplementation(() => {});
        const dispatch = jest.fn((a: any) => a);
        const callback = jest.fn();

        importPortfolioWallet(dispatch, WALLET, 143, true, callback);

        expect(callback).toHaveBeenCalledWith(false, 'success');
        expect(emitSpy).toHaveBeenCalledWith(EventType.REFRESH_WALLET);
        emitSpy.mockRestore();
    });
});

describe('getTransactionName (unchanged classification labels)', () => {
    it('labels a single outgoing send', () => {
        expect(
            getTransactionName({
                type: 'send',
                method: '',
                success: true,
                tokens: [{ in: false }],
                from: WALLET,
                wallet_address: WALLET,
            } as any),
        ).toBe('Transfer Out');
    });

    it('labels failures', () => {
        expect(
            getTransactionName({
                type: 'swap',
                method: '',
                success: false,
                tokens: [],
                from: WALLET,
                wallet_address: WALLET,
            } as any),
        ).toBe('Swap Failed');
    });
});
