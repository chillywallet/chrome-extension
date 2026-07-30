import { BlockscoutProvider } from '../../../src/lib/dataproviders/BlockscoutProvider';
import { CHAIN_CONFIG_ETHEREUM } from '../../../src/config/chains';

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

function makeProvider() {
    return new BlockscoutProvider({
        chain: CHAIN_CONFIG_ETHEREUM,
        config: { kind: 'blockscout', baseUrl: 'https://blockscout.test' },
        apiKey: '',
    });
}

beforeEach(() => {
    fetchMock.mockReset();
});

describe('BlockscoutProvider', () => {
    it('maps native + ERC-20 balances into CoinHolding[]', async () => {
        fetchMock
            .mockReturnValueOnce(jsonResponse({ coin_balance: '2000000000000000000' }))
            .mockReturnValueOnce(
                jsonResponse([
                    {
                        token: {
                            address: TOKEN,
                            name: 'Token A',
                            symbol: 'TKA',
                            decimals: '6',
                            type: 'ERC-20',
                            icon_url: 'https://icon',
                        },
                        value: '1500000',
                    },
                    {
                        token: { address: '0xnft', type: 'ERC-721', name: 'Nifty' },
                        value: '1',
                    },
                ]),
            );

        const holdings = await makeProvider().getTokenHoldings(WALLET);

        expect(holdings).toHaveLength(2); // NFT filtered out
        expect(holdings[0]).toMatchObject({
            token_address: CHAIN_CONFIG_ETHEREUM.native_coin_address,
            balance: 2,
            symbol: 'ETH',
            platform_id: 1,
            is_verified: true,
        });
        expect(holdings[1]).toMatchObject({
            token_address: TOKEN,
            balance: 1.5,
            symbol: 'TKA',
            coin_name: 'Token A',
            logo: 'https://icon',
            token_id: `1:${TOKEN}`,
        });
    });

    it('maps transactions and paginates via next_page_params', async () => {
        fetchMock.mockReturnValueOnce(
            jsonResponse({
                items: [
                    {
                        hash: '0xh1',
                        from: { hash: WALLET },
                        to: { hash: '0x2222222222222222222222222222222222222222' },
                        value: '1000000000000000000',
                        fee: { value: '21000000000000' },
                        status: 'ok',
                        timestamp: '2026-01-01T00:00:00.000000Z',
                        block_number: 100,
                        method: null,
                        tx_types: ['coin_transfer'],
                        token_transfers: [],
                    },
                ],
                next_page_params: { block_number: 99, index: 0 },
            }),
        );

        const provider = makeProvider();
        const pageOne = await provider.getTransactions(WALLET, 1, 10);

        expect(pageOne.data).toHaveLength(1);
        expect(pageOne.data[0]).toMatchObject({
            _id: '0xh1',
            type: 'send',
            success: true,
            platform_id: 1,
        });
        expect(pageOne.data[0].tokens[0]).toMatchObject({ symbol: 'ETH', in: false });
        expect(pageOne.pagination.hasNextPage).toBe(true);

        // page 2 must reuse the stored cursor
        fetchMock.mockReturnValueOnce(jsonResponse({ items: [], next_page_params: null }));
        const pageTwo = await provider.getTransactions(WALLET, 2, 10);
        expect(pageTwo.pagination.hasNextPage).toBe(false);
        const secondUrl = fetchMock.mock.calls[1][0] as string;
        expect(secondUrl).toContain('block_number=99');

        // non-sequential page access returns empty
        const pageNine = await provider.getTransactions(WALLET, 9, 10);
        expect(pageNine.data).toHaveLength(0);
    });

    it('groups NFT instances into collections', async () => {
        fetchMock.mockReturnValueOnce(
            jsonResponse({
                items: [
                    {
                        id: '7',
                        image_url: 'https://img/7',
                        metadata: { name: 'Cool #7' },
                        token: { address: '0xC01', name: 'Cool Cats', type: 'ERC-721' },
                    },
                    {
                        id: '8',
                        image_url: 'https://img/8',
                        metadata: { name: 'Cool #8' },
                        token: { address: '0xC01', name: 'Cool Cats', type: 'ERC-721' },
                    },
                ],
                next_page_params: null,
            }),
        );

        const { nfts, pagination } = await makeProvider().getNFTs(WALLET, '', 1, 10);

        expect(nfts).toHaveLength(1);
        expect(nfts[0]).toMatchObject({ name: 'Cool Cats', address: '0xc01', platform_id: 1 });
        expect(nfts[0].nftDetails).toHaveLength(2);
        expect(nfts[0].nftDetails[0]).toMatchObject({
            name: 'Cool #7',
            token_id: '7',
            image_url: 'https://img/7',
        });
        expect(pagination?.hasNextPage).toBe(false);
    });

    it('degrades gracefully when the API is down', async () => {
        fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: async () => ({}) }));

        const holdings = await makeProvider().getTokenHoldings(WALLET);
        expect(holdings).toHaveLength(1); // native row with 0 balance
        expect(holdings[0].balance).toBe(0);

        const txs = await makeProvider().getTransactions(WALLET, 1, 10);
        expect(txs.data).toHaveLength(0);
    });
});
