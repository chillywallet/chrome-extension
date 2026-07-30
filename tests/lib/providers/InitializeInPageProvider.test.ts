import {
    initializeProvider,
    setGlobalProvider,
} from '../../../src/lib/providers/InitializeInPageProvider';
import { announceProvider } from '../../../src/lib/providers/EIP6963';
import { shimWeb3 } from '../../../src/lib/providers/shimWeb3';

jest.mock('../../../src/lib/providers/InPageProvider', () => ({
    InpageProvider: function MockProvider(this: any) {
        this.chainId = '0x1';
        this.networkVersion = '1';
        this.selectedAddress = null;
        this.request = () => {};
    },
}));

jest.mock('../../../src/lib/providers/EIP6963', () => ({
    announceProvider: jest.fn(),
}));

jest.mock('../../../src/lib/providers/shimWeb3', () => ({
    shimWeb3: jest.fn(),
}));

const stubLog = () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
});

describe('initializeProvider', () => {
    let originalEthereum: any;
    let originalChilly: any;

    beforeEach(() => {
        (announceProvider as jest.Mock).mockClear();
        (shimWeb3 as jest.Mock).mockClear();
        originalEthereum = (window as any).ethereum;
        originalChilly = (window as any).chilly;
        delete (window as any).ethereum;
        delete (window as any).chilly;
    });

    afterEach(() => {
        delete (window as any).ethereum;
        delete (window as any).chilly;
        if (originalEthereum !== undefined) (window as any).ethereum = originalEthereum;
        if (originalChilly !== undefined) (window as any).chilly = originalChilly;
    });

    it('returns an InpageProvider instance and sets it on window by default', () => {
        const stream: any = {};
        const provider = initializeProvider({ connectionStream: stream, logger: stubLog() });
        expect(provider).toBeDefined();
        expect((window as any).chilly).toBeDefined();
        expect((window as any).ethereum).toBeDefined();
    });

    it('does not set on window when shouldSetOnWindow is false', () => {
        const stream: any = {};
        initializeProvider({ connectionStream: stream, shouldSetOnWindow: false });
        expect((window as any).chilly).toBeUndefined();
    });

    it('calls announceProvider when providerInfo is provided', () => {
        const stream: any = {};
        initializeProvider({
            connectionStream: stream,
            providerInfo: {
                uuid: 'x',
                name: 'Chilly',
                icon: 'data:image/png;base64,a',
                rdns: 'io.chilly',
            },
        });
        expect(announceProvider).toHaveBeenCalled();
    });

    it('calls shimWeb3 when shouldShimWeb3 is true', () => {
        const stream: any = {};
        initializeProvider({ connectionStream: stream, shouldShimWeb3: true });
        expect(shimWeb3).toHaveBeenCalled();
    });
});

describe('setGlobalProvider', () => {
    afterEach(() => {
        delete (window as any).chilly;
        delete (window as any).ethereum;
    });

    it('sets chilly and ethereum and dispatches initialized events', () => {
        const events: string[] = [];
        const listener = (e: Event) => events.push(e.type);
        window.addEventListener('chilly#initialized', listener);
        window.addEventListener('ethereum#initialized', listener);

        const provider: any = { foo: 'bar' };
        setGlobalProvider(provider);

        expect((window as any).chilly).toBe(provider);
        expect((window as any).ethereum).toBe(provider);
        expect(events).toContain('chilly#initialized');
        expect(events).toContain('ethereum#initialized');

        window.removeEventListener('chilly#initialized', listener);
        window.removeEventListener('ethereum#initialized', listener);
    });

    it('exposes chainId, networkVersion, and selectedAddress via the proxy getter', () => {
        // returned provider is wrapped in Proxy; reading these props hits the proxy get trap
        const stream: any = {};
        const provider: any = initializeProvider({
            connectionStream: stream,
            shouldSetOnWindow: false,
        });
        // These properties come from the InpageProvider mock
        expect(provider.chainId).toBe('0x1');
        expect(provider.networkVersion).toBe('1');
        expect(provider.selectedAddress).toBeNull();
    });

    it('allows property deletion via proxy deleteProperty trap', () => {
        const stream: any = {};
        const provider: any = initializeProvider({
            connectionStream: stream,
            shouldSetOnWindow: false,
        });
        // deleteProperty returns true; this should not throw
        expect(() => {
            delete provider.chainId;
        }).not.toThrow();
    });

    it('catches errors when chilly#initialized dispatch fails and still attempts ethereum', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const dispatchSpy = jest
            .spyOn(window, 'dispatchEvent')
            .mockImplementationOnce(() => {
                throw new Error('chilly dispatch fail');
            })
            .mockImplementation(() => true);
        const provider: any = { foo: 'chilly-fail' };
        setGlobalProvider(provider);
        expect(errorSpy).toHaveBeenCalledWith(
            'Chilly: Error setting global provider',
            expect.any(Error),
        );
        // ethereum block should still succeed
        expect((window as any).ethereum).toBe(provider);
        errorSpy.mockRestore();
        dispatchSpy.mockRestore();
    });

    it('catches errors when ethereum#initialized dispatch fails', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        let callCount = 0;
        const dispatchSpy = jest
            .spyOn(window, 'dispatchEvent')
            .mockImplementation(() => {
                callCount++;
                if (callCount === 2) {
                    throw new Error('ethereum dispatch fail');
                }
                return true;
            });
        const provider: any = { foo: 'eth-fail' };
        setGlobalProvider(provider);
        expect(errorSpy).toHaveBeenCalledWith(
            'Chilly: Error setting global provider',
            expect.any(Error),
        );
        // chilly is set on the first block
        expect((window as any).chilly).toBe(provider);
        errorSpy.mockRestore();
        dispatchSpy.mockRestore();
    });
});
