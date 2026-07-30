import { CHAIN_CONFIG_BSC } from '../../../src/config/chains';
import { MissingApiKeyError } from '../../../src/lib/dataproviders/DataProvider';
import { EtherscanV2Provider } from '../../../src/lib/dataproviders/EtherscanV2Provider';

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const WALLET = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const TOKEN = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const fetchMock = jest.fn();
(globalThis as any).fetch = fetchMock;

function jsonResponse(payload: any) {
    return Promise.resolve({ ok: true, json: async () => payload });
}

function makeProvider(apiKey = 'test-key') {
    return new EtherscanV2Provider({
        chain: CHAIN_CONFIG_BSC,
        config: {
            kind: 'etherscan',
            baseUrl: 'https://api.etherscan.test/v2/api',
            apiKeyRef: 'etherscan',
        },
        apiKey,
    });
}

beforeEach(() => {
    fetchMock.mockReset();
});

describe('EtherscanV2Provider', () => {
    it('throws MissingApiKeyError without a key', async () => {
        await expect(makeProvider('').getTokenHoldings(WALLET)).rejects.toBeInstanceOf(
            MissingApiKeyError,
        );
    });

    it('discovers tokens from transfer history with the native balance first', async () => {
        fetchMock
            .mockReturnValueOnce(jsonResponse({ status: '1', result: '3000000000000000000' }))
            .mockReturnValueOnce(
                jsonResponse({
                    status: '1',
                    result: [
                        {
                            contractAddress: TOKEN,
                            tokenName: 'Token A',
                            tokenSymbol: 'TKA',
                            tokenDecimal: '18',
                            hash: '0xt1',
                        },
                        {
                            contractAddress: TOKEN, // duplicate ignored
                            tokenName: 'Token A',
                            tokenSymbol: 'TKA',
                            tokenDecimal: '18',
                            hash: '0xt2',
                        },
                    ],
                }),
            );

        const holdings = await makeProvider().getTokenHoldings(WALLET);

        expect(holdings).toHaveLength(2);
        expect(holdings[0]).toMatchObject({ symbol: 'BNB', balance: 3, platform_id: 56 });
        expect(holdings[1]).toMatchObject({
            symbol: 'TKA',
            balance: 0, // balances are Pro-only; refreshed on-chain
            token_id: `56:${TOKEN}`,
        });

        // urls include chainid + apikey
        const firstUrl = fetchMock.mock.calls[0][0] as string;
        expect(firstUrl).toContain('chainid=56');
        expect(firstUrl).toContain('apikey=test-key');
    });

    it('merges txlist and tokentx by hash', async () => {
        fetchMock
            .mockReturnValueOnce(
                jsonResponse({
                    status: '1',
                    result: [
                        {
                            hash: '0xswap',
                            from: WALLET,
                            to: OTHER,
                            value: '0',
                            gasUsed: '100000',
                            gasPrice: '1000000000',
                            isError: '0',
                            timeStamp: '1700000000',
                            blockNumber: '10',
                            methodId: '0x38ed1739',
                            input: '0x38ed1739abcd',
                        },
                    ],
                }),
            )
            .mockReturnValueOnce(
                jsonResponse({
                    status: '1',
                    result: [
                        {
                            hash: '0xswap',
                            from: WALLET,
                            to: OTHER,
                            contractAddress: TOKEN,
                            tokenSymbol: 'TKA',
                            tokenDecimal: '18',
                            value: '1000000000000000000',
                            timeStamp: '1700000000',
                            blockNumber: '10',
                        },
                        {
                            hash: '0xswap',
                            from: OTHER,
                            to: WALLET,
                            contractAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                            tokenSymbol: 'TKB',
                            tokenDecimal: '18',
                            value: '2000000000000000000',
                            timeStamp: '1700000000',
                            blockNumber: '10',
                        },
                    ],
                }),
            );

        const page = await makeProvider().getTransactions(WALLET, 1, 10);

        expect(page.data).toHaveLength(1);
        expect(page.data[0].type).toBe('swap'); // in+out token flows
        expect(page.data[0].tokens).toHaveLength(2);
    });

    it('treats "No transactions found" as an empty result', async () => {
        fetchMock
            .mockReturnValueOnce(jsonResponse({ status: '1', result: '0' }))
            .mockReturnValueOnce(
                jsonResponse({ status: '0', message: 'No transactions found', result: 'No transactions found' }),
            );

        const holdings = await makeProvider().getTokenHoldings(WALLET);
        expect(holdings).toHaveLength(1); // just the native row
    });

    it('derives NFT ownership from transfer history', async () => {
        fetchMock.mockReturnValueOnce(
            jsonResponse({
                status: '1',
                result: [
                    { contractAddress: '0xN', tokenID: '1', tokenName: 'Nifty', from: OTHER, to: WALLET },
                    { contractAddress: '0xN', tokenID: '2', tokenName: 'Nifty', from: OTHER, to: WALLET },
                    { contractAddress: '0xN', tokenID: '1', tokenName: 'Nifty', from: WALLET, to: OTHER },
                ],
            }),
        );

        const { nfts } = await makeProvider().getNFTs(WALLET, '', 1, 10);

        expect(nfts).toHaveLength(1);
        expect(nfts[0].nftDetails).toHaveLength(1); // #1 transferred back out
        expect(nfts[0].nftDetails[0].token_id).toBe('2');
    });
});
