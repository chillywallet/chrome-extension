describe('logger', () => {
    const originalBuildType = process.env.BUILD_TYPE;

    afterEach(() => {
        if (originalBuildType === undefined) {
            delete process.env.BUILD_TYPE;
        } else {
            process.env.BUILD_TYPE = originalBuildType;
        }
        jest.resetModules();
        jest.restoreAllMocks();
    });

    it('exposes log/warn/error/debug/info/trace methods', () => {
        const logger = require('../../../src/shared/utils/logger').default;
        ['log', 'warn', 'error', 'debug', 'info', 'trace'].forEach(name => {
            expect(typeof logger[name]).toBe('function');
        });
    });

    it('forwards calls to console when not Prod', () => {
        process.env.BUILD_TYPE = 'Dev';
        jest.isolateModules(() => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const logger = require('../../../src/shared/utils/logger').default;

            logger.log('hello');
            logger.log('with', 'extra', 'args');
            logger.warn('warning');

            expect(logSpy).toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalled();
        });
    });

    it('silences output in Prod', () => {
        process.env.BUILD_TYPE = 'Prod';
        jest.isolateModules(() => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            const logger = require('../../../src/shared/utils/logger').default;

            logger.log('hello');
            logger.warn('hi');

            expect(logSpy).not.toHaveBeenCalled();
        });
    });
});
