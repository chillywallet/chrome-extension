import { sendSiteMetadata } from '../../../src/lib/providers/siteMetadata';

const stubLog = () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
});

describe('sendSiteMetadata', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.title = '';
    });

    it('sends metadata using og:site_name meta tag', async () => {
        document.head.innerHTML = '<meta property="og:site_name" content="MySite">';
        const engine: any = { handle: jest.fn() };
        await sendSiteMetadata(engine, stubLog());
        expect(engine.handle).toHaveBeenCalledWith(
            expect.objectContaining({ method: expect.any(String) }),
            expect.any(Function),
        );
        const [req] = engine.handle.mock.calls[0];
        expect(req.params.name).toBe('MySite');
    });

    it('falls back to title meta tag', async () => {
        document.head.innerHTML = '<meta name="title" content="TitleMeta">';
        const engine: any = { handle: jest.fn() };
        await sendSiteMetadata(engine, stubLog());
        const [req] = engine.handle.mock.calls[0];
        expect(req.params.name).toBe('TitleMeta');
    });

    it('falls back to document.title', async () => {
        document.title = 'DocTitle';
        const engine: any = { handle: jest.fn() };
        await sendSiteMetadata(engine, stubLog());
        const [req] = engine.handle.mock.calls[0];
        expect(req.params.name).toBe('DocTitle');
    });

    it('falls back to hostname', async () => {
        const engine: any = { handle: jest.fn() };
        await sendSiteMetadata(engine, stubLog());
        const [req] = engine.handle.mock.calls[0];
        expect(typeof req.params.name).toBe('string');
    });

    it('returns null icon when no icon link exists', async () => {
        const engine: any = { handle: jest.fn() };
        await sendSiteMetadata(engine, stubLog());
        const [req] = engine.handle.mock.calls[0];
        expect(req.params.icon).toBeNull();
    });

    it('logs error when engine.handle throws', async () => {
        const log = stubLog();
        const engine: any = {
            handle: jest.fn(() => {
                throw new Error('boom');
            }),
        };
        await sendSiteMetadata(engine, log);
        expect(log.error).toHaveBeenCalled();
    });

    it('returns the first icon whose image loads successfully', async () => {
        document.head.innerHTML =
            '<link rel="icon" href="http://example.com/good.png">';

        const realCreateElement = document.createElement.bind(document);
        const createSpy = jest
            .spyOn(document, 'createElement')
            .mockImplementation((tagName: string, options?: any) => {
                if (tagName === 'img') {
                    const img: any = {};
                    Object.defineProperty(img, 'src', {
                        set(value: string) {
                            img._src = value;
                            // Trigger onload asynchronously to mimic browser
                            setTimeout(() => img.onload && img.onload(), 0);
                        },
                        get() {
                            return img._src;
                        },
                    });
                    return img;
                }
                return realCreateElement(tagName, options);
            });

        const engine: any = { handle: jest.fn() };
        try {
            await sendSiteMetadata(engine, stubLog());
        } finally {
            createSpy.mockRestore();
        }
        const [req] = engine.handle.mock.calls[0];
        expect(req.params.icon).toBe('http://example.com/good.png');
    });

    it('skips icons whose images fail to load and returns null', async () => {
        document.head.innerHTML =
            '<link rel="icon" href="http://example.com/bad.png">';

        const realCreateElement = document.createElement.bind(document);
        const createSpy = jest
            .spyOn(document, 'createElement')
            .mockImplementation((tagName: string, options?: any) => {
                if (tagName === 'img') {
                    const img: any = {};
                    Object.defineProperty(img, 'src', {
                        set(value: string) {
                            img._src = value;
                            setTimeout(() => img.onerror && img.onerror(), 0);
                        },
                        get() {
                            return img._src;
                        },
                    });
                    return img;
                }
                return realCreateElement(tagName, options);
            });

        const engine: any = { handle: jest.fn() };
        try {
            await sendSiteMetadata(engine, stubLog());
        } finally {
            createSpy.mockRestore();
        }
        const [req] = engine.handle.mock.calls[0];
        expect(req.params.icon).toBeNull();
    });

    it('logs error when imgExists throws synchronously while creating img', async () => {
        document.head.innerHTML =
            '<link rel="icon" href="http://example.com/throw.png">';

        const realCreateElement = document.createElement.bind(document);
        const createSpy = jest
            .spyOn(document, 'createElement')
            .mockImplementation((tagName: string, options?: any) => {
                if (tagName === 'img') {
                    throw new Error('create failed');
                }
                return realCreateElement(tagName, options);
            });

        const log = stubLog();
        const engine: any = { handle: jest.fn() };
        try {
            await sendSiteMetadata(engine, log);
        } finally {
            createSpy.mockRestore();
        }
        expect(log.error).toHaveBeenCalled();
        expect(engine.handle).not.toHaveBeenCalled();
    });
});
