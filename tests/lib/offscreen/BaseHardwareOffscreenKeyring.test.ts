import { BaseHardwareOffscreenKeyring } from '../../../src/lib/offscreen/BaseHardwareOffscreenKeyring';

if (typeof (global as any).structuredClone === 'undefined') {
    (global as any).structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v));
}

jest.mock('ethers', () => ({
    getAddress: (a: string) => {
        if (!a.startsWith('0x')) throw new Error('bad checksum');
        return a; // already checksummed in tests
    },
}));

const hardwareTxWireFromTypedCalls: any[] = [];
const typedTransactionFromHardwareSignedWireCalls: any[] = [];

jest.mock('../../../src/lib/offscreen/hardwareTxWire', () => ({
    hardwareTxWireFromTyped: (tx: any) => {
        hardwareTxWireFromTypedCalls.push(tx);
        return { tx: { hex: '0x' }, chainId: '1', hardfork: 'london' };
    },
    typedTransactionFromHardwareSignedWire: (_unsigned: any, signed: any) => {
        typedTransactionFromHardwareSignedWireCalls.push({ _unsigned, signed });
        return signed;
    },
}));

type State = Record<string, any>;

class TestKeyring extends BaseHardwareOffscreenKeyring<State> {
    readonly type = 'test';
    static deps = {
        rpc: jest.fn() as jest.Mock,
        mergeSerialized: jest.fn((_prev: State, fromBridge: State) => structuredClone(fromBridge)),
        applyDiscoveryFromRows: jest.fn(),
        removeAuxiliaryMapsForChecksum: jest.fn(),
    };

    constructor(initial: State = { accounts: [], paths: {} }) {
        super(initial, TestKeyring.deps as any);
    }

    protected emptySerialized(): State {
        return { accounts: [], paths: {} };
    }
}

beforeEach(() => {
    TestKeyring.deps.rpc.mockReset();
    TestKeyring.deps.mergeSerialized.mockReset();
    TestKeyring.deps.mergeSerialized.mockImplementation((_p, b) => structuredClone(b));
    TestKeyring.deps.applyDiscoveryFromRows.mockReset();
    TestKeyring.deps.removeAuxiliaryMapsForChecksum.mockReset();

    Object.defineProperty(global, 'crypto', {
        configurable: true,
        value: { randomUUID: () => 'fixed-instance-id' },
    });
});

describe('BaseHardwareOffscreenKeyring', () => {
    it('init() and getAccounts() work on a fresh keyring', async () => {
        const kr = new TestKeyring();
        await kr.init();
        await expect(kr.getAccounts()).resolves.toEqual([]);
    });

    it('serialize() returns a clone of current data', async () => {
        const kr = new TestKeyring({ accounts: ['0xa'] });
        const serialized = await kr.serialize();
        expect(serialized).toEqual({ accounts: ['0xa'] });
    });

    it('deserialize() with object replaces state; with falsy resets to emptySerialized', async () => {
        const kr = new TestKeyring();
        await kr.deserialize({ accounts: ['0xb'] });
        await expect(kr.getAccounts()).resolves.toEqual(['0xb']);

        await kr.deserialize(null);
        await expect(kr.getAccounts()).resolves.toEqual([]);

        await kr.deserialize([1, 2, 3] as any); // arrays fall through to emptySerialized
        await expect(kr.getAccounts()).resolves.toEqual([]);
    });

    it('destroy() calls rpc dispose and swallows errors', async () => {
        const kr = new TestKeyring();
        TestKeyring.deps.rpc.mockRejectedValue(new Error('port gone'));
        await expect(kr.destroy()).resolves.toBeUndefined();
        expect(TestKeyring.deps.rpc).toHaveBeenCalledWith('fixed-instance-id', 'dispose');
    });

    it('getAccounts() returns [] if accounts is not an array', async () => {
        const kr = new TestKeyring({ accounts: 'not-an-array' as any });
        await expect(kr.getAccounts()).resolves.toEqual([]);
    });

    it('addAccounts() calls rpc and merges new state', async () => {
        const kr = new TestKeyring();
        TestKeyring.deps.rpc.mockResolvedValueOnce({
            serialized: { accounts: ['0xa', '0xb'], paths: {} },
            newAddresses: ['0xa', '0xb'],
        });
        await expect(kr.addAccounts(2)).resolves.toEqual(['0xa', '0xb']);
        expect(TestKeyring.deps.rpc).toHaveBeenCalledWith(
            'fixed-instance-id',
            'addAccounts',
            expect.objectContaining({ n: 2 }),
        );
        await expect(kr.getAccounts()).resolves.toEqual(['0xa', '0xb']);
    });

    it('removeAccount() removes a case-insensitive match and invokes the aux map cleanup', async () => {
        const kr = new TestKeyring({ accounts: ['0xAaa', '0xBbb'], paths: {} });
        await kr.removeAccount('0xaaa');
        await expect(kr.getAccounts()).resolves.toEqual(['0xBbb']);
        expect(TestKeyring.deps.removeAuxiliaryMapsForChecksum).toHaveBeenCalledWith(
            expect.anything(),
            '0xaaa',
        );
    });

    it('removeAccount() throws when the address is not in this keyring', async () => {
        const kr = new TestKeyring({ accounts: ['0xAaa'], paths: {} });
        await expect(kr.removeAccount('0xCcc')).rejects.toThrow(/not found in this keyring/);
    });

    it('removeAccount() throws when accounts is not an array', async () => {
        const kr = new TestKeyring({ accounts: 'broken' as any, paths: {} });
        await expect(kr.removeAccount('0xCcc')).rejects.toThrow(/not found in this keyring/);
    });

    it('signTransaction() routes through rpc wire helpers', async () => {
        hardwareTxWireFromTypedCalls.length = 0;
        typedTransactionFromHardwareSignedWireCalls.length = 0;
        const kr = new TestKeyring();
        TestKeyring.deps.rpc.mockResolvedValueOnce({
            serialized: { accounts: [] },
            signedTx: { __mock: true },
        });
        const tx = {} as any;
        const out = await kr.signTransaction('0xa' as any, tx);
        expect(out).toEqual({ __mock: true });
        expect(hardwareTxWireFromTypedCalls).toContain(tx);
        expect(typedTransactionFromHardwareSignedWireCalls.length).toBeGreaterThan(0);
    });

    it('signPersonalMessage() delegates to rpc and returns signature; signMessage proxies to it', async () => {
        const kr = new TestKeyring();
        TestKeyring.deps.rpc.mockResolvedValue({
            serialized: { accounts: [] },
            signature: '0xsig',
        });
        await expect(kr.signPersonalMessage('0xa' as any, '0xb' as any)).resolves.toBe('0xsig');
        await expect(kr.signMessage('0xa' as any, '0xb' as any)).resolves.toBe('0xsig');
    });

    it('signTypedData() forwards version label as string', async () => {
        const kr = new TestKeyring();
        TestKeyring.deps.rpc.mockResolvedValueOnce({
            serialized: { accounts: [] },
            signature: '0xtd',
        });
        const out = await kr.signTypedData('0xa' as any, { x: 1 }, { version: 'V4' });
        expect(out).toBe('0xtd');
        expect(TestKeyring.deps.rpc).toHaveBeenCalledWith(
            'fixed-instance-id',
            'signTypedData',
            expect.objectContaining({ version: 'V4', data: { x: 1 } }),
        );
    });

    it('signTypedData() coerces non-string version via template string', async () => {
        const kr = new TestKeyring();
        TestKeyring.deps.rpc.mockResolvedValueOnce({
            serialized: { accounts: [] },
            signature: '0x',
        });
        await kr.signTypedData('0xa' as any, {}, { version: 4 as any });
        expect(TestKeyring.deps.rpc).toHaveBeenCalledWith(
            'fixed-instance-id',
            'signTypedData',
            expect.objectContaining({ version: '4' }),
        );
    });

    it('getAddressPage() applies discovery from rows and returns simplified rows', async () => {
        const kr = new TestKeyring();
        TestKeyring.deps.rpc.mockResolvedValueOnce({
            serialized: { accounts: [] },
            accounts: [
                { address: '0xRoot', index: 0, balance: null },
                { address: '0xNext', index: 1 },
            ],
        });

        const out = await kr.getAddressPage('first');
        expect(out).toEqual([
            { address: '0xRoot', index: 0 },
            { address: '0xNext', index: 1 },
        ]);
        expect(TestKeyring.deps.applyDiscoveryFromRows).toHaveBeenCalled();
    });

    it('importAccountsAtIndices() short-circuits to local when paths map covers requested indices', async () => {
        const kr = new TestKeyring({
            accounts: ['0xAaa'],
            paths: { '0xAaa': 0, '0xBbb': 1 },
        });
        const added = await kr.importAccountsAtIndices([1, 1, 1]);
        expect(added).toEqual(['0xBbb']);
        expect(TestKeyring.deps.rpc).not.toHaveBeenCalled();
        await expect(kr.getAccounts()).resolves.toEqual(['0xAaa', '0xBbb']);
    });

    it('importAccountsAtIndices() falls back to rpc when paths are missing', async () => {
        const kr = new TestKeyring({ accounts: [] });
        TestKeyring.deps.rpc.mockResolvedValueOnce({
            serialized: { accounts: ['0xa'] },
            newAddresses: ['0xa'],
        });
        await expect(kr.importAccountsAtIndices([0])).resolves.toEqual(['0xa']);
    });

    it('importAccountsAtIndices() returns [] for an empty input', async () => {
        const kr = new TestKeyring({ accounts: ['0xAaa'], paths: { '0xAaa': 0 } });
        await expect(kr.importAccountsAtIndices([])).resolves.toEqual([]);
    });

    it('importAccountsAtIndices() falls back to rpc when paths entry missing for index', async () => {
        const kr = new TestKeyring({
            accounts: ['0xAaa'],
            paths: { '0xAaa': 0 },
        });
        TestKeyring.deps.rpc.mockResolvedValueOnce({
            serialized: { accounts: ['0xAaa', '0xZ'] },
            newAddresses: ['0xZ'],
        });
        await expect(kr.importAccountsAtIndices([5])).resolves.toEqual(['0xZ']);
        expect(TestKeyring.deps.rpc).toHaveBeenCalled();
    });

    it('importAccountsAtIndices() supports numeric and string path values', async () => {
        const kr = new TestKeyring({
            accounts: [],
            paths: { '0xAaa': '0', '0xBbb': 1 },
        });
        await expect(kr.importAccountsAtIndices([0, 1])).resolves.toEqual(['0xAaa', '0xBbb']);
    });

    it('importAccountsAtIndices() falls back to rpc when paths object contains non-0x keys', async () => {
        const kr = new TestKeyring({
            accounts: [],
            paths: { notHex: 0 } as any,
        });
        TestKeyring.deps.rpc.mockResolvedValueOnce({
            serialized: { accounts: ['0xa'] },
            newAddresses: ['0xa'],
        });
        await expect(kr.importAccountsAtIndices([0])).resolves.toEqual(['0xa']);
    });

    it('importAccountsAtIndices() falls back to rpc when paths is not an object', async () => {
        const kr = new TestKeyring({ accounts: [], paths: [] as any });
        TestKeyring.deps.rpc.mockResolvedValueOnce({
            serialized: { accounts: [] },
            newAddresses: [],
        });
        await expect(kr.importAccountsAtIndices([0])).resolves.toEqual([]);
        expect(TestKeyring.deps.rpc).toHaveBeenCalled();
    });

    it('importAccountsAtIndices() falls back to rpc when accounts is not an array (defensive)', async () => {
        const kr = new TestKeyring({
            accounts: 'broken' as any,
            paths: { '0xAaa': 0 },
        });
        TestKeyring.deps.rpc.mockResolvedValueOnce({
            serialized: { accounts: ['0xAaa'] },
            newAddresses: ['0xAaa'],
        });
        await expect(kr.importAccountsAtIndices([0])).resolves.toEqual(['0xAaa']);
    });
});
