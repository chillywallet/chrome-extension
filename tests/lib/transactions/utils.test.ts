import {
    padHexToEvenLength,
    normalizeTransactionParams,
    isEIP1559Transaction,
    normalizeTxError,
    parseStandardTokenTransactionData,
    readAddressAsContract,
    determineTransactionType,
} from '../../../src/lib/transactions/utils';
import { TransactionType } from '../../../src/shared/types/Transaction';

describe('transactions/utils', () => {
    describe('padHexToEvenLength', () => {
        it('preserves even-length hex', () => {
            expect(padHexToEvenLength('0x1234')).toBe('0x1234');
            expect(padHexToEvenLength('1234')).toBe('1234');
        });

        it('pads odd-length hex with a leading zero', () => {
            expect(padHexToEvenLength('0x123')).toBe('0x0123');
            expect(padHexToEvenLength('abc')).toBe('0abc');
        });
    });

    describe('normalizeTransactionParams', () => {
        it('normalizes known properties to 0x form', () => {
            const normalized = normalizeTransactionParams({
                from: 'ABC',
                to: 'def',
                gas: '5208',
                gasLimit: '5208',
                gasPrice: '01',
                nonce: '1',
                value: '0a',
                data: 'feed',
                maxFeePerGas: '01',
                maxPriorityFeePerGas: '02',
                estimatedBaseFee: '03',
                type: '02',
            } as any);

            expect(normalized.from).toBe('0xabc');
            expect(normalized.to).toBe('0xdef');
            expect(normalized.gas).toBe('0x5208');
            expect((normalized as any).gasLimit).toBe('0x5208');
            expect(normalized.value).toBe('0x0a');
            expect(normalized.data).toBe('0xfeed');
            expect((normalized as any).estimatedBaseFee).toBe('0x03');
        });

        it('defaults value to 0x0 when absent', () => {
            const normalized = normalizeTransactionParams({ from: '0xabc' });
            expect(normalized.value).toBe('0x0');
        });
    });

    describe('isEIP1559Transaction', () => {
        it('returns true when both 1559 fields are present', () => {
            expect(
                isEIP1559Transaction({
                    maxFeePerGas: '1',
                    maxPriorityFeePerGas: '1',
                } as any),
            ).toBe(true);
        });

        it('returns false when 1559 fields are missing', () => {
            expect(isEIP1559Transaction({ gasPrice: '1' } as any)).toBe(false);
        });
    });

    describe('normalizeTxError', () => {
        it('copies error name/message/stack/code', () => {
            const err = Object.assign(new Error('boom'), { code: 'E_BOOM' });
            const result = normalizeTxError(err);
            expect(result.name).toBe('Error');
            expect(result.message).toBe('boom');
            expect(result.code).toBe('E_BOOM');
        });

        it('preserves JSON-compatible "value"', () => {
            const err: any = new Error('x');
            err.value = { a: 1 };
            const result = normalizeTxError(err);
            expect(result.rpc).toEqual({ a: 1 });
        });

        it('drops non-JSON-compatible "value"', () => {
            const cyclic: any = {};
            cyclic.self = cyclic;
            const err: any = new Error('x');
            err.value = cyclic;
            const result = normalizeTxError(err);
            expect(result.rpc).toBeUndefined();
        });
    });

    describe('parseStandardTokenTransactionData', () => {
        it('returns undefined for empty data', () => {
            expect(parseStandardTokenTransactionData()).toBeUndefined();
            expect(parseStandardTokenTransactionData('')).toBeUndefined();
        });

        it('returns undefined for non-matching data', () => {
            expect(parseStandardTokenTransactionData('0xdeadbeef')).toBeUndefined();
        });

        it('parses an ERC20 transfer payload', () => {
            // transfer(address,uint256) = 0xa9059cbb
            const data =
                '0xa9059cbb' +
                '000000000000000000000000' +
                '1111111111111111111111111111111111111111' +
                '0000000000000000000000000000000000000000000000000000000000000064';
            const tx = parseStandardTokenTransactionData(data);
            expect(tx?.name).toMatch(/transfer/i);
        });
    });

    describe('readAddressAsContract', () => {
        function makeProvider({
            code,
            codeThrows,
            network,
            networkThrows,
        }: {
            code?: string | null;
            codeThrows?: boolean;
            network?: { chainId: any };
            networkThrows?: boolean;
        }) {
            return {
                getCode: jest.fn(async () => {
                    if (codeThrows) throw new Error('code-fail');
                    return code as string;
                }),
                getNetwork: jest.fn(async () => {
                    if (networkThrows) throw new Error('network-fail');
                    return network ?? { chainId: 1 };
                }),
            } as any;
        }

        it('returns deployed_contract for addresses with bytecode', async () => {
            const provider = makeProvider({ code: '0x6080604052', network: { chainId: 1 } });
            const result = await readAddressAsContract(provider, '0xabc');
            expect(result.contractCode).toBe('0x6080604052');
            expect(result.isContractLikeAddress).toBe(true);
            expect(result.contractAddressType).toBe('deployed_contract');
            expect(result.isPrecompileOrSystemAddress).toBe(false);
        });

        it('treats ZERO_CODE_VALUES as no bytecode and falls through to EOA classification', async () => {
            const provider = makeProvider({ code: '0x', network: { chainId: 1 } });
            const result = await readAddressAsContract(provider, '0xdef');
            expect(result.isContractLikeAddress).toBe(false);
            expect(result.contractAddressType).toBe('eoa_or_unknown');
        });

        it('classifies known precompiles when no bytecode is present', async () => {
            // 0x01 is a standard Ethereum precompile (ecrecover)
            const provider = makeProvider({ code: '0x', network: { chainId: 1 } });
            const address = '0x0000000000000000000000000000000000000001';
            const result = await readAddressAsContract(provider, address);
            expect(result.isPrecompileOrSystemAddress).toBe(true);
            expect(result.isContractLikeAddress).toBe(true);
            expect(result.contractAddressType).toBe('precompile_or_system_contract');
        });

        it('handles getCode errors by treating the result as null', async () => {
            const provider = makeProvider({ codeThrows: true, network: { chainId: 1 } });
            const result = await readAddressAsContract(provider, '0xabc');
            expect(result.contractCode).toBeNull();
            expect(result.isContractLikeAddress).toBe(false);
        });

        it('handles getNetwork errors by leaving chainId undefined and skipping precompile check', async () => {
            const provider = makeProvider({ code: '0x', networkThrows: true });
            const result = await readAddressAsContract(
                provider,
                '0x0000000000000000000000000000000000000001',
            );
            expect(result.isPrecompileOrSystemAddress).toBe(false);
        });

        it('uses an explicit chainId argument and skips getNetwork', async () => {
            const provider = makeProvider({ code: '0x' });
            const result = await readAddressAsContract(
                provider,
                '0x0000000000000000000000000000000000000001',
                1,
            );
            expect(provider.getNetwork).not.toHaveBeenCalled();
            expect(result.isPrecompileOrSystemAddress).toBe(true);
        });
    });

    describe('determineTransactionType', () => {
        function provider(code: string | null) {
            return {
                getCode: jest.fn(async () => code as string),
                getNetwork: jest.fn(async () => ({ chainId: 1 })),
            } as any;
        }

        it('returns deployContract when data is present and no recipient', async () => {
            const result = await determineTransactionType(
                { data: '0xdead', from: '0xabc' } as any,
                provider(null),
            );
            expect(result.type).toBe(TransactionType.deployContract);
            expect(result.getCodeResponse).toBeUndefined();
        });

        it('returns simpleSend when recipient has no bytecode and is not a precompile', async () => {
            const result = await determineTransactionType(
                { to: '0xrecipient', from: '0xabc' } as any,
                provider('0x'),
            );
            expect(result.type).toBe(TransactionType.simpleSend);
        });

        it('returns contractInteraction when value is non-zero on a contract address', async () => {
            const result = await determineTransactionType(
                { to: '0xrecipient', from: '0xabc', value: '0x1' } as any,
                provider('0x6080'),
            );
            expect(result.type).toBe(TransactionType.contractInteraction);
        });

        it('returns contractInteraction when calling a contract without data', async () => {
            const result = await determineTransactionType(
                { to: '0xrecipient', from: '0xabc' } as any,
                provider('0x6080'),
            );
            expect(result.type).toBe(TransactionType.contractInteraction);
        });

        it('returns contractInteraction when token data does not decode to a known method', async () => {
            // Encoded data that decodes (mocked via parseStandardTokenTransactionData) but with an unknown name.
            // Use 0xdeadbeef which fails decoding, returning undefined → contractInteraction
            const result = await determineTransactionType(
                { to: '0xrecipient', from: '0xabc', data: '0xdeadbeef' } as any,
                provider('0x6080'),
            );
            expect(result.type).toBe(TransactionType.contractInteraction);
        });

        it('falls back to contractInteraction when the decoded method name is outside the token whitelist', async () => {
            // balanceOf(address) = 0x70a08231 — decodes successfully but isn't in the token method whitelist
            const data =
                '0x70a08231' +
                '000000000000000000000000' +
                '1111111111111111111111111111111111111111';
            const result = await determineTransactionType(
                { to: '0xrecipient', from: '0xabc', data } as any,
                provider('0x6080'),
            );
            expect(result.type).toBe(TransactionType.contractInteraction);
        });

        it('returns the matching ERC-20 token method when data decodes to transfer', async () => {
            const data =
                '0xa9059cbb' +
                '000000000000000000000000' +
                '1111111111111111111111111111111111111111' +
                '0000000000000000000000000000000000000000000000000000000000000064';
            const result = await determineTransactionType(
                { to: '0xrecipient', from: '0xabc', data } as any,
                provider('0x6080'),
            );
            expect(result.type).toBe(TransactionType.tokenMethodTransfer);
        });
    });
});
