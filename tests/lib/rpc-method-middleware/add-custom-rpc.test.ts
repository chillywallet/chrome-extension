import addCustomRpc from '../../../src/lib/rpc-method-middleware/add-custom-rpc';

jest.mock('../../../src/lib/ChainsUtils', () => ({
    getCurrentChains: () => [{ chain_id: 1 }, { chain_id: 137 }],
}));

const invoke = async (req: any, hooks: any) => {
    const res: any = {};
    const end = jest.fn();
    await addCustomRpc.implementation(req, res, () => undefined as any, end, hooks);
    return { res, end };
};

describe('add-custom-rpc handler', () => {
    it('rejects when params is not an object', async () => {
        const { end } = await invoke(
            { params: ['x'] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                setCustomNetworks: jest.fn(),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ code: expect.any(Number) }));
    });

    it('rejects when rpcUrl is missing', async () => {
        const { end } = await invoke(
            { params: [{ chainId: '0x1' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                setCustomNetworks: jest.fn(),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/rpcUrl/) }));
    });

    it('rejects non-whitelisted rpc domain', async () => {
        const { end } = await invoke(
            { params: [{ chainId: '0x1', rpcUrl: 'https://evil.example.com/rpc' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                setCustomNetworks: jest.fn(),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/domain is not allowed|RPC URL/) }));
    });

    it('rejects invalid rpcUrl format', async () => {
        const { end } = await invoke(
            { params: [{ chainId: '0x1', rpcUrl: 'not-a-url' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                setCustomNetworks: jest.fn(),
            },
        );
        expect(end).toHaveBeenCalled();
    });

    it('rejects when chainId is not hex', async () => {
        const { end } = await invoke(
            { params: [{ chainId: '1', rpcUrl: 'http://localhost/rpc' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                setCustomNetworks: jest.fn(),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/hexadecimal/) }));
    });

    it('rejects unrecognized chain', async () => {
        const { end } = await invoke(
            { params: [{ chainId: '0x999', rpcUrl: 'http://localhost/rpc' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                setCustomNetworks: jest.fn(),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ code: 4902 }));
    });

    it('rejects mismatched current chain', async () => {
        const { end } = await invoke(
            { params: [{ chainId: '0x89', rpcUrl: 'http://localhost/rpc' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                setCustomNetworks: jest.fn(),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/does not match/) }));
    });

    it('accepts and calls setCustomNetworks on match', async () => {
        const setCustomNetworks = jest.fn(async () => undefined);
        const { res, end } = await invoke(
            { params: [{ chainId: '0x1', rpcUrl: 'http://localhost/rpc' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                setCustomNetworks,
            },
        );
        expect(setCustomNetworks).toHaveBeenCalledWith(1, 'http://localhost/rpc');
        expect(res.result).toBeNull();
        expect(end).toHaveBeenCalled();
    });

    it('forwards setCustomNetworks errors through end', async () => {
        const { end } = await invoke(
            { params: [{ chainId: '0x1', rpcUrl: 'http://localhost/rpc' }] },
            {
                getCurrentChain: () => ({ chain_id: 1 }),
                setCustomNetworks: jest.fn().mockRejectedValueOnce(new Error('failed')),
            },
        );
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ code: 4001 }));
    });
});
