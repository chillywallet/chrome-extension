import {
    buildTransaction,
    classifyTransaction,
} from '../../../src/lib/dataproviders/classify';
import { RawTransaction } from '../../../src/lib/dataproviders/types';

const WALLET = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const TOKEN_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TOKEN_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function rawTx(overrides: Partial<RawTransaction> = {}): RawTransaction {
    return {
        hash: '0xhash',
        from: WALLET,
        to: OTHER,
        value: 0,
        fee: 0.001,
        success: true,
        timestamp: 1700000000,
        block: 123,
        method: '',
        hasData: false,
        transfers: [],
        ...overrides,
    };
}

describe('classifyTransaction', () => {
    it('classifies both-direction token flows as swap', () => {
        const result = classifyTransaction(
            rawTx({
                transfers: [
                    { from: WALLET, to: OTHER, tokenAddress: TOKEN_A, symbol: 'A', decimals: 18, amount: 1 },
                    { from: OTHER, to: WALLET, tokenAddress: TOKEN_B, symbol: 'B', decimals: 18, amount: 2 },
                ],
            }),
            WALLET,
        );
        expect(result.type).toBe('swap');
    });

    it('classifies approve selector as transfer/approve', () => {
        const result = classifyTransaction(rawTx({ method: '0x095ea7b3', hasData: true }), WALLET);
        expect(result).toEqual({ type: 'transfer', method: 'approve' });
    });

    it('classifies swap-named methods as swap', () => {
        const result = classifyTransaction(
            rawTx({ method: 'swapExactTokensForTokens', hasData: true }),
            WALLET,
        );
        expect(result.type).toBe('swap');
    });

    it('classifies outgoing token transfer as send', () => {
        const result = classifyTransaction(
            rawTx({
                method: 'transfer',
                transfers: [
                    { from: WALLET, to: OTHER, tokenAddress: TOKEN_A, symbol: 'A', decimals: 18, amount: 1 },
                ],
            }),
            WALLET,
        );
        expect(result).toEqual({ type: 'send', method: 'transfer' });
    });

    it('classifies incoming token transfer as transfer', () => {
        const result = classifyTransaction(
            rawTx({
                from: OTHER,
                to: WALLET,
                method: 'transfer',
                transfers: [
                    { from: OTHER, to: WALLET, tokenAddress: TOKEN_A, symbol: 'A', decimals: 18, amount: 1 },
                ],
            }),
            WALLET,
        );
        expect(result).toEqual({ type: 'transfer', method: 'transfer' });
    });

    it('classifies plain native transfer as send', () => {
        const result = classifyTransaction(rawTx({ value: 1.5 }), WALLET);
        expect(result).toEqual({ type: 'send', method: '' });
    });

    it('classifies calldata-bearing tx without transfers as contract interaction', () => {
        const result = classifyTransaction(
            rawTx({ method: '0x12345678', hasData: true }),
            WALLET,
        );
        expect(result.type).toBe('transfer');
        expect(result.method).toBe('0x12345678');
    });
});

describe('buildTransaction', () => {
    it('produces the UI Transaction shape with synthetic token ids', () => {
        const tx = buildTransaction(
            rawTx({
                value: 2,
                transfers: [
                    { from: OTHER, to: WALLET, tokenAddress: TOKEN_A, symbol: 'A', decimals: 6, amount: 5 },
                ],
                to: WALLET,
                from: OTHER,
            }),
            WALLET,
            143,
            'MON',
            NATIVE,
        );

        expect(tx._id).toBe('0xhash');
        expect(tx.platform_id).toBe(143);
        expect(tx.currency).toBe('MON');
        expect(tx.wallet_address).toBe(WALLET);
        expect(tx.additional_properties).toEqual({ transaction_hash: '0xhash', block: 123 });

        // native + token entries
        expect(tx.tokens).toHaveLength(2);
        expect(tx.tokens[0]).toMatchObject({
            symbol: 'MON',
            address: NATIVE,
            in: true,
            token_id: `143:${NATIVE}`,
        });
        expect(tx.tokens[1]).toMatchObject({
            symbol: 'A',
            in: true,
            token_id: `143:${TOKEN_A}`,
        });

        expect(tx.transfers).toHaveLength(1);
        expect(tx.transfers[0]).toMatchObject({
            token_symbol: 'A',
            token_meta: { decimals: 6, logo: '', name: 'A' },
        });

        // ISO timestamp from unix seconds
        expect(tx.timestamp).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it('ignores transfers not involving the wallet in tokens[]', () => {
        const tx = buildTransaction(
            rawTx({
                transfers: [
                    { from: OTHER, to: OTHER, tokenAddress: TOKEN_A, symbol: 'A', decimals: 18, amount: 1 },
                ],
            }),
            WALLET,
            1,
            'ETH',
            NATIVE,
        );
        expect(tx.tokens).toHaveLength(0);
        expect(tx.transfers).toHaveLength(1); // transfers list keeps everything
    });
});
