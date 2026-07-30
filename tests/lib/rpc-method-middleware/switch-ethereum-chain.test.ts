import switchEthereumChain from '../../../src/lib/rpc-method-middleware/switch-ethereum-chain';
import { getCurrentChainByChainId } from '../../../src/lib/ChainsUtils';

jest.mock('../../../src/lib/ChainsUtils', () => ({
    getCurrentChainByChainId: jest.fn(),
}));

const invoke = async (req: any, hooks: any) => {
    const res: any = {};
    const end = jest.fn();
    await switchEthereumChain.implementation(req, res, () => undefined as any, end, hooks);
    return { res, end };
};

describe('switch-ethereum-chain handler', () => {
    beforeEach(() => {
        (getCurrentChainByChainId as jest.Mock).mockReset();
    });

    it('rejects when params is not an object', async () => {
        const { end } = await invoke(
            { params: ['x'] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                requestUserApproval: jest.fn(),
                setSelectedNetwork: jest.fn(),
                isSenderActiveBrowserTab: jest.fn(),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ code: expect.any(Number) }));
    });

    it('rejects when params has unexpected keys', async () => {
        const { end } = await invoke(
            { params: [{ chainId: '0x1', other: 1 }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                requestUserApproval: jest.fn(),
                setSelectedNetwork: jest.fn(),
                isSenderActiveBrowserTab: jest.fn(),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/unexpected keys/i) }));
    });

    it('rejects when chainId is not properly formatted hex', async () => {
        const { end } = await invoke(
            { params: [{ chainId: '1' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                requestUserApproval: jest.fn(),
                setSelectedNetwork: jest.fn(),
                isSenderActiveBrowserTab: jest.fn(),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/hexadecimal/) }));
    });

    it('returns null when current chain matches request', async () => {
        (getCurrentChainByChainId as jest.Mock).mockReturnValue({ chain_id: 1 });
        const { res, end } = await invoke(
            { params: [{ chainId: '0x1' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                requestUserApproval: jest.fn(),
                setSelectedNetwork: jest.fn(),
                isSenderActiveBrowserTab: jest.fn(async () => true),
            },
        );
        expect(res.result).toBeNull();
        expect(end).toHaveBeenCalled();
    });

    it('rejects when chain is unrecognized', async () => {
        (getCurrentChainByChainId as jest.Mock).mockReturnValue(undefined);
        const { end } = await invoke(
            { params: [{ chainId: '0x1' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                requestUserApproval: jest.fn(),
                setSelectedNetwork: jest.fn(),
                isSenderActiveBrowserTab: jest.fn(async () => true),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ code: 4902 }));
    });

    it('rejects when sender is not active browser tab', async () => {
        (getCurrentChainByChainId as jest.Mock).mockReturnValue({ chain_id: 2 });
        const { end } = await invoke(
            { params: [{ chainId: '0x2' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                requestUserApproval: jest.fn(),
                setSelectedNetwork: jest.fn(),
                isSenderActiveBrowserTab: jest.fn(async () => false),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/active browser tab/i) }));
    });

    it('calls setSelectedNetwork on user approval', async () => {
        (getCurrentChainByChainId as jest.Mock).mockReturnValue({ chain_id: 2 });
        const requestUserApproval = jest.fn(async () => undefined);
        const setSelectedNetwork = jest.fn(async () => undefined);
        const { res, end } = await invoke(
            { params: [{ chainId: '0x2' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                requestUserApproval,
                setSelectedNetwork,
                isSenderActiveBrowserTab: jest.fn(async () => true),
            },
        );
        expect(requestUserApproval).toHaveBeenCalled();
        expect(setSelectedNetwork).toHaveBeenCalledWith(2);
        expect(res.result).toBeNull();
        expect(end).toHaveBeenCalled();
    });

    it('forwards approval rejection through end', async () => {
        (getCurrentChainByChainId as jest.Mock).mockReturnValue({ chain_id: 2 });
        const err = new Error('user rejected');
        const { end } = await invoke(
            { params: [{ chainId: '0x2' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                requestUserApproval: jest.fn().mockRejectedValueOnce(err),
                setSelectedNetwork: jest.fn(),
                isSenderActiveBrowserTab: jest.fn(async () => true),
            },
        );
        expect(end).toHaveBeenCalledWith(err);
    });
});
