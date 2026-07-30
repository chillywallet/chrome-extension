import {
    sanitizeHex,
    convertAmountToRawNumber,
    toHex,
    hexToNumber,
    toWei,
    fromWei,
    convertHexToString,
    convertStringToHex,
    convertRawAmountToDecimalFormat,
    fraction,
    addBuffer,
    greaterThan,
    getDataForTokenTransfer,
    getDataForNftTransfer,
    getTxDetails,
    getTransferNftTransaction,
    getTransferTokenTransaction,
    createSignableTransaction,
    buildTransaction,
    estimateGas,
    estimateGasLimit,
    estimateGasWithPadding,
    sendRpcCall,
} from '../../src/lib/web3';
import { AssetType } from '../../src/shared/types/Wallet';

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/api/graphQL/BaseRequest', () => ({
    getErrorMessage: (e: any) => (e?.message ?? String(e)),
}));

describe('web3 numeric helpers', () => {
    it('sanitizeHex pads odd hex strings', () => {
        expect(sanitizeHex('0x123')).toBe('0x0123');
        expect(sanitizeHex('1234')).toBe('0x1234');
        expect(sanitizeHex('0x')).toBe('');
    });

    it('convertAmountToRawNumber multiplies by 10^decimals', () => {
        expect(convertAmountToRawNumber('1', 18)).toBe('1000000000000000000');
        expect(convertAmountToRawNumber('1.5', 2)).toBe('150');
    });

    it('toHex and hexToNumber round-trip integers', () => {
        const hex = toHex(255);
        expect(hex).toMatch(/^0x/);
        expect(hexToNumber(hex)).toBe(255);
    });

    it('toWei converts eth to wei', () => {
        expect(toWei('1')).toBe('1000000000000000000');
    });

    it('fromWei and convertRawAmountToDecimalFormat', () => {
        expect(fromWei('1000000000000000000')).toBe('1');
        expect(convertRawAmountToDecimalFormat('100', 2)).toBe('1');
    });

    it('convertHexToString and convertStringToHex', () => {
        expect(convertHexToString('0xff')).toBe('255');
        expect(convertStringToHex('255')).toBe('ff');
    });

    it('fraction handles zeros and computes ratios', () => {
        expect(fraction(0, 1, 2)).toBe('0');
        expect(fraction(100, 1, 2)).toBe('50');
    });

    it('addBuffer multiplies by buffer factor', () => {
        expect(addBuffer('100')).toBe('120');
        expect(addBuffer('100', '1.5')).toBe('150');
    });

    it('greaterThan compares values', () => {
        expect(greaterThan('10', '5')).toBe(true);
        expect(greaterThan('5', '10')).toBe(false);
    });
});

describe('web3 transaction data helpers', () => {
    it('getDataForTokenTransfer builds a transfer call', () => {
        const data = getDataForTokenTransfer(
            '100',
            '0x1111111111111111111111111111111111111111',
        );
        expect(typeof data).toBe('string');
        expect(data.length).toBeGreaterThan(0);
    });

    it('getDataForNftTransfer for ERC721', () => {
        const data = getDataForNftTransfer('0xabc', '0xdef', {
            id: '1',
            address: '0x0',
            type: AssetType.nft,
            nftType: 'ERC721',
        } as any);
        expect(data).toMatch(/^[0-9a-fx]+$/i);
    });

    it('getDataForNftTransfer for ERC1155', () => {
        const data = getDataForNftTransfer('0xabc', '0xdef', {
            id: '1',
            address: '0x0',
            type: AssetType.nft,
            nftType: 'ERC1155',
        } as any);
        expect(data).toMatch(/^[0-9a-fx]+$/i);
    });
});

describe('getTxDetails', () => {
    it('returns base tx + maxFeePerGas when EIP-1559 fields provided', async () => {
        const result = await getTxDetails({
            to: '0xto',
            amount: '1',
            gasLimit: '21000',
            maxFeePerGas: '50',
            maxPriorityFeePerGas: '2',
        } as any);
        expect(result.maxFeePerGas).toBe('50');
        expect(result.maxPriorityFeePerGas).toBe('2');
    });

    it('returns base tx + gasPrice when legacy gasPrice provided', async () => {
        const result = await getTxDetails({
            to: '0xto',
            amount: '1',
            gasLimit: '21000',
            gasPrice: '5',
        } as any);
        expect((result as any).gasPrice).toBe('5');
    });

    it('throws when no gas pricing is provided', async () => {
        await expect(
            getTxDetails({ to: '0xto', amount: '1', gasLimit: '21000' } as any),
        ).rejects.toThrow(/Gas price/);
    });
});

describe('transfer transaction builders', () => {
    it('getTransferNftTransaction populates data and to-address', async () => {
        const result = await getTransferNftTransaction({
            from: '0xabc',
            to: '0xdef',
            asset: { id: '1', address: '0xcontract', type: AssetType.nft, nftType: 'ERC721' },
            gasLimit: '50000',
            gasPrice: '5',
        } as any);
        expect(result.to).toBe('0xcontract');
        expect(typeof result.data).toBe('string');
    });

    it('getTransferNftTransaction throws on missing recipient', async () => {
        await expect(
            getTransferNftTransaction({
                from: '0xabc',
                to: '',
                asset: { id: '1', address: '0xcontract', type: AssetType.nft, nftType: 'ERC721' },
            } as any),
        ).rejects.toThrow(/Invalid recipient/);
    });

    it('getTransferTokenTransaction sets data and contract address', async () => {
        const result = await getTransferTokenTransaction({
            from: '0xabc',
            to: '0xdef',
            amount: '100',
            asset: { type: AssetType.token, address: '0xcontract' },
            gasLimit: '50000',
            gasPrice: '5',
        } as any);
        expect(result.to).toBe('0xcontract');
        expect(typeof result.data).toBe('string');
    });
});

describe('createSignableTransaction', () => {
    it('delegates to getTxDetails for native asset', async () => {
        const result = await createSignableTransaction({
            to: '0xto',
            amount: '1',
            gasLimit: '21000',
            gasPrice: '5',
            asset: { type: AssetType.native },
        } as any);
        expect((result as any).gasPrice).toBe('5');
    });

    it('returns a token transfer tx with EIP-1559 fields', async () => {
        const result = await createSignableTransaction({
            from: '0xabc',
            to: '0xdef',
            amount: '100',
            gasLimit: '21000',
            maxFeePerGas: '50',
            maxPriorityFeePerGas: '2',
            asset: { type: AssetType.token, address: '0xcontract' },
        } as any);
        expect(result.to).toBe('0xcontract');
        expect(result.maxFeePerGas).toBe('50');
    });

    it('returns an NFT transfer tx', async () => {
        const result = await createSignableTransaction({
            from: '0xabc',
            to: '0xdef',
            amount: '1',
            gasLimit: '21000',
            gasPrice: '5',
            asset: { type: AssetType.nft, address: '0xcontract', id: '1', nftType: 'ERC721' },
        } as any);
        expect(result.to).toBe('0xcontract');
    });
});

describe('buildTransaction', () => {
    it('builds tx for native asset (default branch)', async () => {
        const tx = await buildTransaction({
            address: '0xfrom',
            amount: '1',
            recipient: '0xto',
            asset: { type: AssetType.native } as any,
        });
        expect(tx.from).toBe('0xfrom');
        expect(tx.to).toBe('0xto');
        expect(tx.value).toBe('1');
    });

    it('builds tx for nft asset', async () => {
        const tx = await buildTransaction({
            address: '0xfrom',
            amount: '1',
            recipient: '0xto',
            asset: { type: AssetType.nft, address: '0xcontract', id: '1', nftType: 'ERC721' } as any,
        });
        expect(tx.to).toBe('0xcontract');
        expect(typeof tx.data).toBe('string');
    });

    it('builds tx for token asset', async () => {
        const tx = await buildTransaction({
            address: '0xfrom',
            amount: '100',
            recipient: '0xto',
            asset: { type: AssetType.token, address: '0xcontract' } as any,
        });
        expect(tx.to).toBe('0xcontract');
        expect(tx.value).toBe('0x0');
    });
});

describe('estimateGas', () => {
    it('returns the estimate when provider succeeds', async () => {
        const provider: any = { estimateGas: jest.fn(async () => BigInt(21000)) };
        const result = await estimateGas({} as any, provider);
        expect(result).toBe('21000');
    });

    it('returns null when provider throws', async () => {
        const provider: any = {
            estimateGas: jest.fn(async () => {
                throw new Error('boom');
            }),
        };
        const result = await estimateGas({} as any, provider);
        expect(result).toBeNull();
    });
});

describe('estimateGasLimit', () => {
    it('uses padding when > 0', async () => {
        const provider: any = {
            getBlock: jest.fn(async () => ({ gasLimit: BigInt(10000000) })),
            getCode: jest.fn(async () => '0x'),
            estimateGas: jest.fn(async () => BigInt(21000)),
        };
        const result = await estimateGasLimit(
            {
                address: '0xfrom',
                recipient: '0xto',
                amount: '1',
                asset: { type: AssetType.native } as any,
            },
            provider,
            1.5,
        );
        expect(typeof result).toBe('string');
    });

    it('returns raw estimate when no padding', async () => {
        const provider: any = { estimateGas: jest.fn(async () => BigInt(42)) };
        const result = await estimateGasLimit(
            {
                address: '0xfrom',
                recipient: '0xto',
                amount: '1',
                asset: { type: AssetType.native } as any,
            },
            provider,
        );
        expect(result).toBe('42');
    });
});

describe('estimateGasWithPadding', () => {
    it('returns null when no provider', async () => {
        const result = await estimateGasWithPadding(
            {} as any,
            null,
            null,
            undefined as any,
        );
        expect(result).toBeNull();
    });

    it('returns the default 21000 for plain transfers', async () => {
        const provider: any = {
            getBlock: jest.fn(async () => ({ gasLimit: BigInt(10000000) })),
            getCode: jest.fn(async () => '0x'),
        };
        const result = await estimateGasWithPadding(
            { to: '0xto', data: undefined } as any,
            null,
            null,
            provider,
        );
        expect(result).toBe('21000');
    });

    it('uses contractCallEstimateGas when provided', async () => {
        const provider: any = {
            getBlock: jest.fn(async () => ({ gasLimit: BigInt(10_000_000) })),
            getCode: jest.fn(async () => '0xabcd'),
        };
        const contractCall = jest.fn(async () => BigInt(50_000));

        const result = await estimateGasWithPadding(
            { to: '0xto', data: '0xff' } as any,
            contractCall,
            ['arg'],
            provider,
            1.1,
        );

        expect(contractCall).toHaveBeenCalled();
        expect(typeof result).toBe('string');
    });

    it('throws a normalized error if getBlock fails', async () => {
        const provider: any = {
            getBlock: jest.fn(async () => {
                throw new Error('block fetch failed');
            }),
        };
        await expect(
            estimateGasWithPadding({ to: '0xto' } as any, null, null, provider),
        ).rejects.toThrow(/block fetch failed/);
    });
});

describe('sendRpcCall', () => {
    it('forwards method and params to provider.send', async () => {
        const send = jest.fn(async () => '0x1');
        const provider: any = { send };
        const result = await sendRpcCall(
            { method: 'eth_chainId', params: [] } as any,
            provider,
        );
        expect(send).toHaveBeenCalledWith('eth_chainId', []);
        expect(result).toBe('0x1');
    });
});

describe('extra branch coverage', () => {
    it('convertAmountToRawNumber uses default decimals=18', () => {
        expect(convertAmountToRawNumber('1')).toBe('1000000000000000000');
    });

    it('getTxDetails leaves gasLimit undefined when missing', async () => {
        const result = await getTxDetails({
            to: '0xto',
            amount: '1',
            gasPrice: '5',
        } as any);
        expect((result as any).gasLimit).toBeUndefined();
    });

    it('estimateGas returns null when provider returns nullish', async () => {
        const provider: any = { estimateGas: jest.fn(async () => undefined) };
        const result = await estimateGas({} as any, provider);
        expect(result).toBeNull();
    });

    it('estimateGasWithPadding falls back to 21000 when no contractCall and no `to`', async () => {
        const provider: any = {
            getBlock: jest.fn(async () => ({ gasLimit: BigInt(10_000_000) })),
            getCode: jest.fn(async () => '0x'),
        };
        const result = await estimateGasWithPadding(
            { data: '0xff' } as any,
            null,
            null,
            provider,
        );
        expect(result).toBe('21000');
    });

    it('estimateGasWithPadding uses default paddingFactor=1.1', async () => {
        const provider: any = {
            getBlock: jest.fn(async () => ({ gasLimit: BigInt(10_000_000) })),
            getCode: jest.fn(async () => '0xabcd'),
            estimateGas: jest.fn(async () => BigInt(50_000)),
        };
        const result = await estimateGasWithPadding(
            { to: '0xto', data: '0xff' } as any,
            null,
            null,
            provider,
        );
        expect(typeof result).toBe('string');
    });

    it('estimateGasWithPadding returns null when provider is null', async () => {
        const result = await estimateGasWithPadding(
            { to: '0xto', data: '0xff' } as any,
            null,
            null,
            null as any,
        );
        expect(result).toBeNull();
    });

    it('estimateGasWithPadding returns estimated when above last block gas limit', async () => {
        // gasLimit=1_000_000 → safer = 950_000; lastBlockGasLimit = 1_000_000 * 0.9 = 900_000
        // estimatedGas=2_000_000 > 900_000 → return estimatedGas
        const provider: any = {
            getBlock: jest.fn(async () => ({ gasLimit: BigInt(1_000_000) })),
            getCode: jest.fn(async () => '0xabcd'),
            estimateGas: jest.fn(async () => BigInt(2_000_000)),
        };
        const result = await estimateGasWithPadding(
            { to: '0xto', data: '0xff' } as any,
            null,
            null,
            provider,
            1.1,
        );
        expect(result).toBe('2000000');
    });
});
