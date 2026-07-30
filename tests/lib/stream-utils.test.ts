import { setupMultiplex, isStreamWritable } from '../../src/lib/stream-utils';
import logger from '../../src/shared/utils/logger';
import { CONNECTION_READY } from '../../src/shared/constants/app';

jest.mock('@metamask/object-multiplex', () => {
    class MockObjectMultiplex {
        ignoreStream = jest.fn();
        pipe = jest.fn();
        on = jest.fn();
        destroy = jest.fn();
    }
    return { __esModule: true, default: MockObjectMultiplex };
});

jest.mock('readable-stream', () => {
    const real = jest.requireActual('readable-stream');
    const mockPipeline = jest.fn();
    (globalThis as any).__SU_PIPELINE__ = mockPipeline;
    return { ...real, pipeline: mockPipeline };
});

const pipelineMock = (globalThis as any).__SU_PIPELINE__ as jest.Mock;

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

beforeEach(() => {
    jest.clearAllMocks();
});

describe('setupMultiplex', () => {
    it('returns the mux and ignores the keep-alive stream', () => {
        const stream: any = {};
        const mux = setupMultiplex(stream);
        expect(mux.ignoreStream).toHaveBeenCalledWith(CONNECTION_READY);
        expect(pipelineMock).toHaveBeenCalled();
    });

    it('logs unexpected pipeline errors', () => {
        const stream: any = {};
        setupMultiplex(stream);
        const errCb = pipelineMock.mock.calls[0].at(-1) as Function;
        errCb(new Error('something broke'));
        expect(logger.error).toHaveBeenCalled();
    });

    it('does not log "Premature close" errors', () => {
        const stream: any = {};
        setupMultiplex(stream);
        const errCb = pipelineMock.mock.calls[0].at(-1) as Function;
        errCb(new Error('Premature close'));
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('does not log when err is null', () => {
        const stream: any = {};
        setupMultiplex(stream);
        const errCb = pipelineMock.mock.calls[0].at(-1) as Function;
        errCb(null);
        expect(logger.error).not.toHaveBeenCalled();
    });
});

describe('isStreamWritable', () => {
    it('returns true for a healthy writable stream', () => {
        expect(isStreamWritable({ writable: true, destroyed: false } as any)).toBe(true);
    });

    it('returns false when writable is false', () => {
        expect(isStreamWritable({ writable: false, destroyed: false } as any)).toBe(false);
    });

    it('returns false when destroyed', () => {
        expect(isStreamWritable({ writable: true, destroyed: true } as any)).toBe(false);
    });

    it('returns false when _writableState.ended is true', () => {
        expect(
            isStreamWritable({
                writable: true,
                destroyed: false,
                _writableState: { ended: true },
            } as any),
        ).toBe(false);
    });

    it('returns true when _writableState is present but not ended', () => {
        expect(
            isStreamWritable({
                writable: true,
                destroyed: false,
                _writableState: { ended: false },
            } as any),
        ).toBe(true);
    });
});
