import {
    sanitizeSeedPhrase,
    handleGasPrice,
    isNativeCoinBySymbol,
    isNativeCoinByPlatformId,
    isNativeCoinByPlatformIdAndTokenAddress,
    isNativeCoinByTokenAddress,
    getNativeSymbol,
    getGasData,
    formatSafeFixed,
    safeParseUnits,
    toSafeFixed,
    stripHexPrefix,
    hexToText,
    getSwapTokenAddress,
    omitFlatten,
    getTransactionErrorMessage,
    retryFunc,
    getUUIDOptionsFromMnemonic,
    getUUIDFromMnemonic,
    getUUIDOptionsFromAddress,
    getUUIDFromAddress,
} from '../../src/lib/WalletUtils';
import { GasType } from '../../src/shared/types/Wallet';
import { GasPriceType } from '../../src/shared/types/Chain';
import { DEFAULT_CHAIN } from '../../src/lib/ChainsUtils';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/api/graphQL/BaseRequest', () => ({
    getErrorMessage: (e: any) => e?.message ?? String(e),
}));

const chainsUtilsOverrides: {
    getCurrentChainByChain?: (...args: any[]) => any;
    getCurrentChainByPlatformId?: (...args: any[]) => any;
} = {};

jest.mock('../../src/lib/ChainsUtils', () => {
    const actual = jest.requireActual('../../src/lib/ChainsUtils');
    return {
        __esModule: true,
        ...actual,
        getCurrentChainByChain: (...args: any[]) =>
            chainsUtilsOverrides.getCurrentChainByChain
                ? chainsUtilsOverrides.getCurrentChainByChain(...args)
                : actual.getCurrentChainByChain(...args),
        getCurrentChainByPlatformId: (...args: any[]) =>
            chainsUtilsOverrides.getCurrentChainByPlatformId
                ? chainsUtilsOverrides.getCurrentChainByPlatformId(...args)
                : actual.getCurrentChainByPlatformId(...args),
    };
});

afterEach(() => {
    chainsUtilsOverrides.getCurrentChainByChain = undefined;
    chainsUtilsOverrides.getCurrentChainByPlatformId = undefined;
});

describe('sanitizeSeedPhrase', () => {
    it('trims, collapses whitespace, drops blanks', () => {
        expect(sanitizeSeedPhrase('  a   b\n c\r\n d  ')).toBe('a b c d');
    });
});

describe('handleGasPrice', () => {
    it('uses suggested gas in BaseAndPriority mode when present', () => {
        const result = handleGasPrice(
            undefined,
            GasType.Suggest,
            undefined,
            GasPriceType.BaseAndPriority,
            { priorityFee: 1n, maxFeePerGas: 10n, baseFee: 5n },
        );
        expect(result.gasPrice).toBe(10n);
        expect(result.gasInfo.maxFeePerGas).toBe(10n);
    });

    it('uses custom gas in BaseAndPriority mode when present', () => {
        const result = handleGasPrice(
            undefined,
            GasType.Custom,
            { priorityFee: 2n, maxFeePerGas: 20n, baseFee: 5n },
            GasPriceType.BaseAndPriority,
        );
        expect(result.gasInfo.maxFeePerGas).toBe(20n);
    });

    it('falls back to gasOptionsData for Low/Medium/High', () => {
        const opts = {
            low: { priorityFee: 1n, baseFee: 1n, maxFeePerGas: 1n },
            medium: { priorityFee: 2n, baseFee: 2n, maxFeePerGas: 2n },
            high: { priorityFee: 3n, baseFee: 3n, maxFeePerGas: 3n },
        } as any;

        expect(
            handleGasPrice(opts, GasType.Low, undefined, GasPriceType.BaseAndPriority).gasPrice,
        ).toBe(1n);
        expect(
            handleGasPrice(opts, GasType.Medium, undefined, GasPriceType.BaseAndPriority).gasPrice,
        ).toBe(2n);
        expect(
            handleGasPrice(opts, GasType.High, undefined, GasPriceType.BaseAndPriority).gasPrice,
        ).toBe(3n);
    });

    it('legacy gas price branch (not BaseAndPriority)', () => {
        const opts = {
            low: { gasPrice: 1n },
            medium: { gasPrice: 2n },
            high: { gasPrice: 3n },
        } as any;

        expect(
            handleGasPrice(opts, GasType.Low, undefined, 'Legacy' as GasPriceType).gasPrice,
        ).toBe(1n);
        expect(
            handleGasPrice(
                undefined,
                GasType.Suggest,
                undefined,
                'Legacy' as GasPriceType,
                { gasPrice: 99n },
            ).gasPrice,
        ).toBe(99n);
        expect(
            handleGasPrice(
                undefined,
                GasType.Custom,
                { gasPrice: 50n } as any,
                'Legacy' as GasPriceType,
            ).gasPrice,
        ).toBe(50n);
    });
});

describe('native coin checks', () => {
    it('isNativeCoinBySymbol matches the chain symbol', () => {
        expect(
            isNativeCoinBySymbol(DEFAULT_CHAIN.chain_key, DEFAULT_CHAIN.native_coin_symbol),
        ).toBe(true);
        expect(isNativeCoinBySymbol(DEFAULT_CHAIN.chain_key, 'NOT_REAL')).toBe(false);
    });

    it('isNativeCoinBySymbol returns false for unknown chain', () => {
        expect(isNativeCoinBySymbol('unknown' as any, 'X')).toBe(false);
    });

    it('isNativeCoinByPlatformId matches', () => {
        expect(
            isNativeCoinByPlatformId(
                DEFAULT_CHAIN.platform_id,
                DEFAULT_CHAIN.native_coin_symbol,
            ),
        ).toBe(true);
    });

    it('isNativeCoinByPlatformIdAndTokenAddress matches EVM native token', () => {
        expect(
            isNativeCoinByPlatformIdAndTokenAddress(
                DEFAULT_CHAIN.platform_id,
                '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            ),
        ).toBe(true);
    });

    it('isNativeCoinByPlatformIdAndTokenAddress returns false on unknown', () => {
        expect(isNativeCoinByPlatformIdAndTokenAddress(99999, '0xabc')).toBe(false);
    });

    it('isNativeCoinByTokenAddress matches EVM native token', () => {
        expect(
            isNativeCoinByTokenAddress(
                DEFAULT_CHAIN.chain_key,
                '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            ),
        ).toBe(true);
    });

    it('isNativeCoinByTokenAddress returns false on unknown', () => {
        expect(isNativeCoinByTokenAddress('unknown' as any, '0xabc')).toBe(false);
        expect(isNativeCoinByTokenAddress(DEFAULT_CHAIN.chain_key, null)).toBe(false);
    });

    it('getNativeSymbol returns the chain symbol or fallback', () => {
        expect(getNativeSymbol(DEFAULT_CHAIN.chain_key)).toBe(
            DEFAULT_CHAIN.native_coin_symbol,
        );
        expect(getNativeSymbol('unknown' as any)).toBe('ETH');
    });
});

describe('getGasData', () => {
    it('returns type-2 data with maxFeePerGas', () => {
        const result = getGasData({ maxFeePerGas: 1n, priorityFee: 2n } as any);
        expect(result.type).toBe(2);
        expect(result.maxFeePerGas).toMatch(/^0x/);
        expect(result.maxPriorityFeePerGas).toMatch(/^0x/);
    });

    it('returns type-1 data with gasPrice', () => {
        const result = getGasData({ gasPrice: 5n } as any);
        expect(result.type).toBe(1);
        expect(result.gasPrice).toMatch(/^0x/);
    });

    it('throws when gas info is empty', () => {
        expect(() => getGasData({} as any)).toThrow(/gasInfo is incorrect/);
    });
});

describe('numeric helpers', () => {
    it('formatSafeFixed clamps and floors', () => {
        expect(formatSafeFixed(1.23456789, 4)).toBe('1.2345');
        expect(formatSafeFixed('', 6)).toBe('0');
        expect(formatSafeFixed('   ', 6)).toBe('0');
        expect(formatSafeFixed(null as any, 6)).toBe('0');
        expect(formatSafeFixed('not-a-number', 6)).toBe('0');
        expect(formatSafeFixed(0, 4)).toBe('0');
        expect(formatSafeFixed('1,5', 2)).toBe('1.5');
        expect(formatSafeFixed(1.234, 2, false)).toBe('1.23');
    });

    it('safeParseUnits returns bigint, falling back to 0', () => {
        expect(typeof safeParseUnits('1', 18)).toBe('bigint');
        expect(safeParseUnits('bad' as any, 18)).toBe(BigInt(0));
    });

    it('toSafeFixed rounds based on decimals', () => {
        expect(toSafeFixed(1.123456, 2)).toBe('1.12');
        expect(toSafeFixed('1.5')).toBe('1.5');
    });

    it('stripHexPrefix removes 0x', () => {
        expect(stripHexPrefix('0xabc')).toBe('abc');
        expect(stripHexPrefix('abc')).toBe('abc');
        // typing escape hatch
        expect(stripHexPrefix(123 as any)).toBe(123);
    });

    it('hexToText decodes hex strings to utf8 or returns original', () => {
        const hexHi = '0x' + Buffer.from('hi').toString('hex');
        expect(hexToText(hexHi)).toBe('hi');
        expect(hexToText('')).toBe('');
        // 32-byte (64-char) hex returns the original input
        const long = '0x' + 'aa'.repeat(32);
        expect(hexToText(long)).toBe(long);
    });
});

describe('getSwapTokenAddress', () => {
    it('returns coin.coinAddress when present', () => {
        expect(
            getSwapTokenAddress({ coinAddress: '0xtoken' } as any, DEFAULT_CHAIN.chain_key),
        ).toBe('0xtoken');
    });

    it('returns native_coin_address when symbol matches the chain', () => {
        expect(
            getSwapTokenAddress(
                { symbol: DEFAULT_CHAIN.native_coin_symbol } as any,
                DEFAULT_CHAIN.chain_key,
            ),
        ).toBe(DEFAULT_CHAIN.native_coin_address);
    });

    it('returns null when no match', () => {
        expect(
            getSwapTokenAddress({ symbol: 'NOPE' } as any, DEFAULT_CHAIN.chain_key),
        ).toBeNull();
    });
});

describe('omitFlatten', () => {
    it('removes a single key', () => {
        expect(omitFlatten({ a: 1, b: 2 }, 'a' as any)).toEqual({ b: 2 });
    });

    it('removes multiple keys', () => {
        expect(omitFlatten({ a: 1, b: 2, c: 3 }, ['a', 'b'] as any)).toEqual({ c: 3 });
    });
});

describe('getTransactionErrorMessage', () => {
    it('parses JSON body', () => {
        const result = getTransactionErrorMessage({
            body: JSON.stringify({ error: { message: 'json-err' } }),
        });
        expect(result).toBe('json-err');
    });

    it('falls back to reason', () => {
        expect(getTransactionErrorMessage({ reason: 'because' })).toBe('because');
    });

    it('returns Unknown Error otherwise', () => {
        expect(getTransactionErrorMessage({})).toBe('Unknown Error');
    });

    it('handles invalid JSON gracefully', () => {
        expect(
            getTransactionErrorMessage({ body: 'not-json', reason: 'fallback' }),
        ).toBe('fallback');
    });

    it('returns Unknown Error for null/undefined', () => {
        expect(getTransactionErrorMessage(null)).toBe('Unknown Error');
        expect(getTransactionErrorMessage(undefined)).toBe('Unknown Error');
    });

    it('extracts nested originalError JSON-RPC body inside data', () => {
        const err = {
            data: {
                originalError: {
                    body: JSON.stringify({ error: { message: 'nested message' } }),
                },
            },
        };
        expect(getTransactionErrorMessage(err)).toBe('nested message');
    });

    it('reads info.error.message when present', () => {
        const err = { info: { error: { message: '  info-msg  ' } } };
        expect(getTransactionErrorMessage(err)).toBe('info-msg');
    });

    it('extracts wrapped error JSON from a message string', () => {
        const wrapped =
            'failed to send tx (error={"message":"insufficient funds"}, ...)';
        expect(getTransactionErrorMessage({ message: wrapped })).toBe('insufficient funds');
    });

    it('falls back to regex extraction when wrapped JSON is malformed', () => {
        const wrapped = 'error={"message":"slipped","extra":}';
        expect(getTransactionErrorMessage({ message: wrapped })).toBe('slipped');
    });

    it('returns undefined extraction path on dangling open brace', () => {
        // unmatched brace → indexOfClosingBrace returns -1 → falls through
        const wrapped = 'foo error={"message":"x"';
        expect(getTransactionErrorMessage({ message: wrapped, reason: 'fallback' })).toBe(
            'fallback',
        );
    });

    it('extracts wrapped error JSON inside shortMessage', () => {
        expect(
            getTransactionErrorMessage({
                shortMessage: 'failed: error={"message":"boom"}',
            }),
        ).toBe('boom');
    });

    it('extracts wrapped error JSON inside reason', () => {
        expect(
            getTransactionErrorMessage({ reason: 'wrap: error={"message":"r"}' }),
        ).toBe('r');
    });

    it('reads inner error.message at the top level', () => {
        const err = { error: { message: 'inner!' } };
        expect(getTransactionErrorMessage(err)).toBe('inner!');
    });

    it('walks .cause chain up to the depth limit', () => {
        const root = { cause: { cause: { reason: 'deep cause' } } };
        expect(getTransactionErrorMessage(root)).toBe('deep cause');
    });

    it('stops on cycles in .cause without throwing', () => {
        const a: any = {};
        a.cause = a;
        expect(getTransactionErrorMessage(a)).toBe('Unknown Error');
    });

    it('uses top-level shortMessage when the cursor walk finds nothing', () => {
        expect(
            getTransactionErrorMessage({ shortMessage: 'short and sweet', cause: {} }),
        ).toBe('short and sweet');
    });

    it('ignores top-level "could not coalesce" shortMessage and falls back to message', () => {
        expect(
            getTransactionErrorMessage({
                shortMessage: 'could not coalesce error',
                message: 'final-msg',
                cause: {},
            }),
        ).toBe('final-msg');
    });

    it('uses top-level message when shortMessage is missing', () => {
        expect(getTransactionErrorMessage({ message: 'top-msg', cause: {} })).toBe(
            'top-msg',
        );
    });

    it('returns Unknown Error when message starts with "could not coalesce"', () => {
        expect(
            getTransactionErrorMessage({ message: 'could not coalesce', cause: {} }),
        ).toBe('Unknown Error');
    });
});

describe('retryFunc', () => {
    it('returns the result on first success', async () => {
        const fn = jest.fn(async () => 'ok');
        await expect(retryFunc(fn)).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries the function on failure', async () => {
        let calls = 0;
        const fn = async () => {
            calls++;
            if (calls < 2) throw new Error('again');
            return 'ok';
        };

        await expect(retryFunc(fn, { count: 3, delay: 0 })).resolves.toBe('ok');
        expect(calls).toBe(2);
    });

    it('throws after exhausting retries', async () => {
        const fn = jest.fn(async () => {
            throw new Error('boom');
        });
        await expect(retryFunc(fn, { count: 1, delay: 0 })).rejects.toThrow('boom');
        expect(fn).toHaveBeenCalledTimes(2);
    });
});

describe('UUID helpers', () => {
    it('produces a v4 UUID from a mnemonic', () => {
        const mnemonic = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        expect(getUUIDFromMnemonic(mnemonic)).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
    });

    it('produces a v4 UUID from an address', () => {
        const address = '0x32Be343B94f860124dC4fEe278FDCBD38C102D88';
        expect(getUUIDFromAddress(address)).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
    });

    it('UUID options expose a 16-byte random seed', () => {
        const mnemonic = new Uint8Array([1, 2, 3, 4]);
        expect(getUUIDOptionsFromMnemonic(mnemonic).random).toHaveLength(16);

        const opts = getUUIDOptionsFromAddress('0x32Be343B94f860124dC4fEe278FDCBD38C102D88');
        expect(opts.random).toHaveLength(16);
    });
});

describe('native coin checks — fall-through and catch branches', () => {
    it('isNativeCoinByPlatformId returns false when chain lookup returns undefined', () => {
        chainsUtilsOverrides.getCurrentChainByPlatformId = () => undefined;
        expect(isNativeCoinByPlatformId(1, 'ETH')).toBe(false);
    });

    it('isNativeCoinByPlatformIdAndTokenAddress compares native_coin_address when chain found', () => {
        // Use a non-EVM-native tokenAddress so we go past the early return,
        // and force lookup to return a known chain with that native_coin_address.
        chainsUtilsOverrides.getCurrentChainByPlatformId = () => ({
            native_coin_address: '0xnative',
            native_coin_symbol: 'X',
        });
        expect(isNativeCoinByPlatformIdAndTokenAddress(1, '0xnative')).toBe(true);
        // Also confirm the false-by-mismatch path
        expect(isNativeCoinByPlatformIdAndTokenAddress(1, '0xother')).toBe(false);
    });

    it('isNativeCoinByPlatformIdAndTokenAddress returns false when chain lookup returns undefined', () => {
        chainsUtilsOverrides.getCurrentChainByPlatformId = () => undefined;
        expect(isNativeCoinByPlatformIdAndTokenAddress(1, '0xabc')).toBe(false);
    });

    it('isNativeCoinByPlatformIdAndTokenAddress catches and returns false on lookup throw', () => {
        chainsUtilsOverrides.getCurrentChainByPlatformId = () => {
            throw new Error('lookup boom');
        };
        expect(isNativeCoinByPlatformIdAndTokenAddress(1, '0xdef')).toBe(false);
    });

    it('isNativeCoinByTokenAddress catches and returns false when lookup throws', () => {
        chainsUtilsOverrides.getCurrentChainByChain = () => {
            throw new Error('boom');
        };
        expect(isNativeCoinByTokenAddress('whatever' as any, '0xabc')).toBe(false);
    });
});

describe('safeParseUnits / hexToText error branches', () => {
    it('safeParseUnits returns 0n when parseUnits throws (invalid decimals)', () => {
        // ethers.parseUnits with non-integer decimals throws
        expect(safeParseUnits('1', 1.5 as any)).toBe(BigInt(0));
    });

    it('hexToText returns input when decoding throws', () => {
        // Pass a value that breaks Buffer.from via stripHexPrefix internals
        // Buffer.from with an invalid hex char silently truncates, so force a throw
        // by feeding a value whose `slice` will throw — use a frozen typed string proxy.
        const evil: any = {
            toString: () => 'abc',
        };
        // Patch String#startsWith via prototype override is heavy; instead, make
        // stripHexPrefix path throw by passing a value whose String coercion fails.
        // Simpler: pass an object pretending to be a string that fails inside try.
        Object.defineProperty(evil, Symbol.toPrimitive, {
            value: () => {
                throw new Error('coerce-fail');
            },
        });
        // hexToText only gets called with strings in production, but the catch
        // handles unexpected throws.
        expect(hexToText(evil)).toBe(evil);
    });
});

describe('retryFunc delay branch', () => {
    it('waits the configured delay before retrying', async () => {
        let calls = 0;
        const fn = async () => {
            calls++;
            if (calls < 2) throw new Error('again');
            return 'done';
        };
        await expect(retryFunc(fn, { count: 2, delay: 1 })).resolves.toBe('done');
        expect(calls).toBe(2);
    });
});

describe('handleGasPrice nullish-coalescing branches', () => {
    it('BaseAndPriority Suggest with undefined priorityFee uses 0n', () => {
        const result = handleGasPrice(
            undefined,
            GasType.Suggest,
            undefined,
            GasPriceType.BaseAndPriority,
            { maxFeePerGas: 10n, baseFee: 5n } as any, // priorityFee undefined
        );
        expect(result.gasInfo.priorityFee).toBe(0n);
    });

    it('BaseAndPriority Custom with undefined priorityFee uses 0n', () => {
        const result = handleGasPrice(
            undefined,
            GasType.Custom,
            { maxFeePerGas: 20n, baseFee: 5n } as any,
            GasPriceType.BaseAndPriority,
        );
        expect(result.gasInfo.priorityFee).toBe(0n);
    });

    it('BaseAndPriority Medium with gasOptionsData missing fields defaults to 0n', () => {
        const opts = {
            low: {},
            medium: {},
            high: {},
        } as any;
        const result = handleGasPrice(
            opts,
            GasType.Medium,
            undefined,
            GasPriceType.BaseAndPriority,
        );
        expect(result.gasInfo.priorityFee).toBe(0n);
        expect(result.gasInfo.baseFee).toBe(0n);
        expect(result.gasInfo.maxFeePerGas).toBe(0n);
    });

    it('BaseAndPriority Medium with undefined gasOption falls through to defaults', () => {
        const result = handleGasPrice(
            { low: undefined, medium: undefined, high: undefined } as any,
            GasType.Medium,
            undefined,
            GasPriceType.BaseAndPriority,
        );
        expect(result.gasInfo.priorityFee).toBe(0n);
    });

    it('legacy branch Medium with missing gasPrice defaults to 0n', () => {
        const result = handleGasPrice(
            { low: {}, medium: {}, high: {} } as any,
            GasType.Medium,
            undefined,
            'Legacy' as GasPriceType,
        );
        expect(result.gasPrice).toBe(0n);
    });

    it('legacy branch with no data anywhere returns 0n', () => {
        const result = handleGasPrice(
            undefined,
            GasType.Suggest,
            undefined,
            'Legacy' as GasPriceType,
        );
        expect(result.gasPrice).toBe(0n);
    });

    it('BaseAndPriority Suggest missing baseFee falls through', () => {
        const result = handleGasPrice(
            undefined,
            GasType.Suggest,
            undefined,
            GasPriceType.BaseAndPriority,
            { maxFeePerGas: 10n } as any, // missing baseFee
        );
        expect(result.gasInfo.maxFeePerGas).toBe(0n);
    });

    it('BaseAndPriority Custom missing baseFee falls through', () => {
        const result = handleGasPrice(
            undefined,
            GasType.Custom,
            { maxFeePerGas: 20n } as any, // missing baseFee
            GasPriceType.BaseAndPriority,
        );
        expect(result.gasInfo.maxFeePerGas).toBe(0n);
    });
});

describe('getGasData priorityFee nullish branch', () => {
    it('uses 0n maxPriorityFeePerGas when priorityFee undefined', () => {
        const result = getGasData({ maxFeePerGas: 5n } as any);
        expect(result.type).toBe(2);
        // toHex(0n) should produce a hex string
        expect(result.maxPriorityFeePerGas).toMatch(/^0x/);
    });
});

describe('formatSafeFixed defaults', () => {
    it('uses default decimals when omitted', () => {
        expect(formatSafeFixed(1.123456789)).toMatch(/^1\./);
    });
});

describe('safeParseUnits defaults', () => {
    it('uses default 18 decimals when omitted', () => {
        expect(typeof safeParseUnits('1')).toBe('bigint');
    });
});

describe('toSafeFixed without explicit decimals', () => {
    it('returns full decimal precision when decimals is omitted', () => {
        expect(toSafeFixed(1.5)).toBe('1.5');
    });
});

describe('getSwapTokenAddress polygon-MATIC branch', () => {
    it('matches MATIC on polygon chain', () => {
        chainsUtilsOverrides.getCurrentChainByChain = () => ({
            chain_key: 'polygon',
            native_coin_symbol: 'POL',
            native_coin_address: '0xpolnative',
        });
        expect(
            getSwapTokenAddress({ symbol: 'MATIC' } as any, 'polygon' as any),
        ).toBe('0xpolnative');
    });

    it('returns null when no coin provided', () => {
        chainsUtilsOverrides.getCurrentChainByChain = () => ({
            chain_key: 'ethereum',
            native_coin_symbol: 'ETH',
            native_coin_address: '0xethnative',
        });
        expect(getSwapTokenAddress(null, 'ethereum' as any)).toBeNull();
    });

    it('returns null when chain lookup returns undefined', () => {
        chainsUtilsOverrides.getCurrentChainByChain = () => undefined;
        expect(
            getSwapTokenAddress({ symbol: 'X' } as any, 'unknown' as any),
        ).toBeNull();
    });
});

describe('getTransactionErrorMessage edge branches', () => {
    it('handles non-string body (skips JSON parse path)', () => {
        expect(
            getTransactionErrorMessage({ body: { error: 'object' }, reason: 'r' }),
        ).toBe('r');
    });

    it('handles JSON body without error.message and falls back', () => {
        expect(
            getTransactionErrorMessage({ body: JSON.stringify({ other: 1 }), reason: 'fb' }),
        ).toBe('fb');
    });
});

describe('omitFlatten edge case', () => {
    it('returns empty object when input is null', () => {
        expect(omitFlatten(null, 'a' as any)).toEqual({});
    });
});
