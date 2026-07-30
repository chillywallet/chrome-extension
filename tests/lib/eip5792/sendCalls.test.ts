import { validateWalletSendCallsPreflight } from '../../../src/lib/eip5792/sendCalls';
import {
    getBatchCallsContractAddress,
    getSupportedChainIds,
} from '../../../src/lib/eip5792/capabilities';

jest.mock('../../../src/lib/eip5792/capabilities', () => ({
    getSupportedChainIds: jest.fn(() => [1, 137]),
    getBatchCallsContractAddress: jest.fn(() => '0xBatch'),
}));

const body = (override: any = {}) => ({
    version: '1.0',
    chainId: '0x1',
    calls: [{ to: '0xa', data: '0x' }],
    ...override,
});

describe('validateWalletSendCallsPreflight', () => {
    beforeEach(() => {
        (getSupportedChainIds as jest.Mock).mockReturnValue([1, 137]);
        (getBatchCallsContractAddress as jest.Mock).mockReturnValue('0xBatch');
    });

    it('rejects when body is null', () => {
        const res = validateWalletSendCallsPreflight(null, 1);
        expect(res.ok).toBe(false);
    });

    it('rejects when version is missing', () => {
        const res = validateWalletSendCallsPreflight({ ...body(), version: undefined } as any, 1);
        expect(res.ok).toBe(false);
    });

    it('rejects when calls is empty', () => {
        const res = validateWalletSendCallsPreflight(body({ calls: [] }) as any, 1);
        expect(res.ok).toBe(false);
    });

    it('rejects when chainId is missing', () => {
        const res = validateWalletSendCallsPreflight(body({ chainId: undefined }) as any, 1);
        expect(res.ok).toBe(false);
    });

    it('rejects when chainId is not finite', () => {
        const res = validateWalletSendCallsPreflight(body({ chainId: 'not-hex' }) as any, 1);
        expect(res.ok).toBe(false);
    });

    it('rejects when chainId is unsupported', () => {
        const res = validateWalletSendCallsPreflight(body({ chainId: '0x999' }) as any, 1);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.message).toMatch(/Unsupported/);
    });

    it('rejects when chainId does not match active session', () => {
        const res = validateWalletSendCallsPreflight(body({ chainId: '0x89' }) as any, 1);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.message).toMatch(/does not match/);
    });

    it('rejects when atomicRequired and chain has no batch contract', () => {
        (getBatchCallsContractAddress as jest.Mock).mockReturnValueOnce(undefined);
        const res = validateWalletSendCallsPreflight(body({ atomicRequired: true }) as any, 1);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.message).toMatch(/Atomic/);
    });

    it('accepts valid params', () => {
        const res = validateWalletSendCallsPreflight(body() as any, 1);
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.chainIdNum).toBe(1);
    });

    it('accepts numeric chainId', () => {
        const res = validateWalletSendCallsPreflight(body({ chainId: 137 }) as any, 137);
        expect(res.ok).toBe(true);
    });
});
