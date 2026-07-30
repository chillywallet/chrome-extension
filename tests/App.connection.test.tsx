/**
 * @jest-environment jsdom
 */

import { CONTROLLER, INTERNAL_PROVIDER } from '../src/shared/constants/stream';
import { connectToAccountManager, setupControllerConnection, setupWeb3Connection } from '../src/App';
import StreamProvider from 'web3-stream-provider';

jest.mock('webextension-polyfill', () => require('./helpers/webextensionTestMock.js'));

jest.mock('../src/shared/utils/logger', () => ({
    __esModule: true,
    default: {
        log: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
    },
}));

jest.mock('../src/shared/utils/browser-runtime-utils', () => ({
    isManifestV3: false,
    checkForLastErrorAndLog: jest.fn(),
}));

jest.mock('../src/shared/utils/utils', () => ({
    __esModule: true,
    getEnvironmentType: jest.fn(() => 'popup'),
}));

jest.mock('../src/ui', () => ({
    __esModule: true,
    default: jest.fn(),
    startReloadPage: jest.fn(),
    updateBackgroundConnection: jest.fn(),
}));

jest.mock('../src/lib/ExtensionPlatform', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(function MockPlatform(this: Record<string, unknown>) {
        this.openExtensionInBrowser = jest.fn();
    }),
}));

jest.mock('../src/lib/stream-utils.js', () => {
    const mux = {
        createStreamNames: [] as string[],
        createStream(name: string) {
            mux.createStreamNames.push(name);
            return {
                pipe: (d: unknown) => d,
                on: () => {},
            };
        },
    };
    function setupMultiplexStub(_conn: unknown) {
        return mux;
    }
    return {
        setupMultiplex: setupMultiplexStub,
        __muxForTests: mux,
    };
});

jest.mock('../src/lib/RPCClientFactory.js', () => {
    const rpcClient = { mocked: true as const };
    function createRPCClientFactoryStub(_stream: unknown) {
        return rpcClient;
    }
    return {
        __esModule: true,
        default: createRPCClientFactoryStub,
        __rpcForTests: rpcClient,
    };
});

jest.mock('web3-stream-provider', () => {
    function MockStreamProvider(this: { pipe: (o: unknown) => unknown; on: () => void }) {
        this.pipe = function (other: unknown) {
            return other;
        };
        this.on = function () {};
    }
    return { __esModule: true, default: MockStreamProvider };
});

jest.mock('@metamask/eth-query', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('@metamask/ethjs', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const getTestMux = () =>
    (jest.requireMock('../src/lib/stream-utils.js') as typeof import('../src/lib/stream-utils') & {
        __muxForTests: { createStreamNames: string[] };
    }).__muxForTests;

const getTestRpc = () =>
    (jest.requireMock('../src/lib/RPCClientFactory.js') as typeof import('../src/lib/RPCClientFactory') & {
        __rpcForTests: { mocked: true };
    }).__rpcForTests;

describe('App connection helpers', () => {
    beforeEach(() => {
        delete (global as any).ethereumProvider;
        delete (global as any).ethQuery;
        delete (global as any).eth;
        getTestMux().createStreamNames.length = 0;
    });

    it('setupControllerConnection passes the stream into the RPC factory and callback', () => {
        const stream = {};
        const cb = jest.fn();
        setupControllerConnection(stream as any, cb);
        expect(cb).toHaveBeenCalledWith(getTestRpc());
    });

    it('connectToAccountManager multiplexes controller and web3 streams', () => {
        const connectionStream = { tag: 'conn' };
        const cb = jest.fn();
        connectToAccountManager(connectionStream as any, cb);
        expect(getTestMux().createStreamNames).toEqual(
            expect.arrayContaining([CONTROLLER, INTERNAL_PROVIDER]),
        );
        expect(cb).toHaveBeenCalledWith(getTestRpc());
    });

    it('setupWeb3Connection pipes a StreamProvider into the connection stream and exposes globals', () => {
        const connectionStream = {
            pipe: jest.fn((dest: unknown) => dest),
            on: jest.fn(),
        };
        setupWeb3Connection(connectionStream as any);
        const providerInst = (global as any).ethereumProvider;
        expect(StreamProvider).toBeDefined();
        expect(providerInst).toBeInstanceOf(StreamProvider);
        expect(connectionStream.pipe).toHaveBeenCalled();
        expect((global as any).ethereumProvider).toBe(providerInst);
        expect((global as any).ethQuery).toBeDefined();
        expect((global as any).eth).toBeDefined();
    });
});
