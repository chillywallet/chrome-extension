import { CHAIN_CONFIG_MONAD } from '../../../src/config/chains';
import { BlockVisionProvider } from '../../../src/lib/dataproviders/BlockVisionProvider';
import { MissingApiKeyError } from '../../../src/lib/dataproviders/DataProvider';

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const WALLET = '0x1111111111111111111111111111111111111111';
const TOKEN = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const fetchMock = jest.fn();
(globalThis as any).fetch = fetchMock;

function jsonResponse(payload: any) {
    return Promise.resolve({ ok: true, json: async () => payload });
}

function makeProvider(apiKey = 'bv-key') {
    return new BlockVisionProvider({
        chain: CHAIN_CONFIG_MONAD,
        config: {
            kind: 'blockvision',
            baseUrl: 'https://api.blockvision.test/v2/monad',
            apiKeyRef: 'blockvision',
        },
        apiKey,
    });
}

beforeEach(() => {
    fetchMock.mockReset();
});

describe('BlockVisionProvider', () => {
    it('throws MissingApiKeyError without a key', async () => {
        await expect(makeProvider('').getTokenHoldings(WALLET)).rejects.toBeInstanceOf(
            MissingApiKeyError,
        );
    });

    it('maps token balances, keeping the native coin first', async () => {
        fetchMock.mockReturnValueOnce(
            jsonResponse({
                code: 0,
                result: {
                    data: [
                        {
                            contractAddress: TOKEN,
                            name: 'Token A',
                            symbol: 'TKA',
                            decimal: 6,
                            balance: '12.5',
                            imageURL: 'https://icon',
                            verified: true,
                        },
                        {
                            contractAddress: '0x0000000000000000000000000000000000000000',
                            name: 'Monad',
                            symbol: 'MON',
                            decimal: 18,
                            balance: '3.25',
                        },
                    ],
                },
            }),
        );

        const holdings = await makeProvider().getTokenHoldings(WALLET);

        expect(holdings).toHaveLength(2);
        expect(holdings[0]).toMatchObject({ symbol: 'MON', balance: 3.25, platform_id: 143 });
        expect(holdings[1]).toMatchObject({
            symbol: 'TKA',
            balance: 12.5,
            is_verified: true,
            token_id: `143:${TOKEN}`,
        });

        // API key goes in the x-api-key header
        const init = fetchMock.mock.calls[0][1];
        expect(init.headers['x-api-key']).toBe('bv-key');
    });

    it('maps transactions and paginates by cursor', async () => {
        fetchMock.mockReturnValueOnce(
            jsonResponse({
                code: 0,
                result: {
                    data: [
                        {
                            hash: '0xh1',
                            from: WALLET,
                            to: '0x2222222222222222222222222222222222222222',
                            value: '1.5',
                            transactionFee: '0.0001',
                            status: 1,
                            timestamp: 1700000000000,
                            blockNumber: 5,
                            methodName: '',
                        },
                    ],
                    nextPageCursor: 'cursor-2',
                },
            }),
        );

        const provider = makeProvider();
        const page = await provider.getTransactions(WALLET, 1, 10);

        expect(page.data).toHaveLength(1);
        expect(page.data[0]).toMatchObject({
            _id: '0xh1',
            type: 'send',
            success: true,
            platform_id: 143,
            currency: 'MON',
        });
        expect(page.pagination.hasNextPage).toBe(true);

        fetchMock.mockReturnValueOnce(
            jsonResponse({ code: 0, result: { data: [], nextPageCursor: null } }),
        );
        await provider.getTransactions(WALLET, 2, 10);
        const secondUrl = fetchMock.mock.calls[1][0] as string;
        expect(secondUrl).toContain('cursor=cursor-2');
    });

    it('maps NFT collections', async () => {
        fetchMock.mockReturnValueOnce(
            jsonResponse({
                code: 0,
                result: {
                    data: [
                        {
                            contractAddress: '0xC01',
                            name: 'Monad Punks',
                            ercStandard: 'ERC-721',
                            imageURL: 'https://col',
                            verified: true,
                            items: [
                                { tokenId: '9', name: 'Punk #9', imageURL: 'https://img/9' },
                            ],
                        },
                    ],
                },
            }),
        );

        const { nfts } = await makeProvider().getNFTs(WALLET, '', 1, 10);

        expect(nfts).toHaveLength(1);
        expect(nfts[0]).toMatchObject({ name: 'Monad Punks', platform_id: 143 });
        expect(nfts[0].nftDetails[0]).toMatchObject({
            name: 'Punk #9',
            token_id: '9',
            image_url: 'https://img/9',
        });
    });

    it('surfaces API-level errors as empty results', async () => {
        fetchMock.mockReturnValue(jsonResponse({ code: 429, reason: 'rate limited' }));
        const page = await makeProvider().getTransactions(WALLET, 1, 10);
        expect(page.data).toHaveLength(0);
    });
});
