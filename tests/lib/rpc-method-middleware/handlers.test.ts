import getProviderState from '../../../src/lib/rpc-method-middleware/get-provider-state';
import sendMetadata from '../../../src/lib/rpc-method-middleware/send-metadata';
import ethAccounts from '../../../src/lib/rpc-method-middleware/eth-accounts';

describe('get-provider-state handler', () => {
    it('exposes methodNames and hookNames', () => {
        expect(getProviderState.methodNames.length).toBeGreaterThan(0);
        expect(getProviderState.hookNames.getProviderState).toBe(true);
    });

    it('writes provider state to result and ends', async () => {
        const res: any = {};
        const end = jest.fn();
        await getProviderState.implementation(
            { origin: 'o' } as any,
            res,
            () => {},
            end,
            {
                getProviderState: async () => ({
                    chainId: '0x1',
                    isUnlocked: true,
                    networkVersion: '1',
                }),
            } as any,
        );
        expect(res.result.chainId).toBe('0x1');
        expect(end).toHaveBeenCalled();
    });
});

describe('send-metadata handler', () => {
    it('adds subject metadata and resolves true', () => {
        const addSubjectMetadata = jest.fn();
        const end = jest.fn();
        const res: any = {};
        sendMetadata.implementation(
            {
                origin: 'https://x',
                params: { name: 'X', icon: 'i.png' },
            } as any,
            res,
            () => {},
            end,
            { addSubjectMetadata, subjectType: 'website' } as any,
        );
        expect(addSubjectMetadata).toHaveBeenCalledWith(
            expect.objectContaining({ origin: 'https://x', iconUrl: 'i.png', name: 'X' }),
        );
        expect(res.result).toBe(true);
        expect(end).toHaveBeenCalled();
    });

    it('rejects invalid params', () => {
        const end = jest.fn();
        sendMetadata.implementation(
            { params: ['not-an-object'] } as any,
            {} as any,
            () => {},
            end,
            { addSubjectMetadata: jest.fn(), subjectType: 'website' } as any,
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ code: expect.any(Number) }));
    });
});

describe('eth-accounts handler', () => {
    it('returns accounts from getAccounts hook', async () => {
        const res: any = {};
        const end = jest.fn();
        const getAccounts = jest.fn(async () => ['0xabc']);
        await ethAccounts.implementation({} as any, res, () => {}, end, { getAccounts } as any);
        expect(res.result).toEqual(['0xabc']);
        expect(end).toHaveBeenCalled();
    });
});
