import logger from '../shared/utils/logger';

/**
 * Returns a middleware that logs RPC activity. Logging is detailed in
 * development builds, but more limited in production builds.
 *
 * @param {{ origin: string }} opts - The middleware options
 * @returns {Function}
 */
export default function createLoggerMiddleware(opts: { origin: string }) {
    return function loggerMiddleware(req: any, res: any, next: Function, end: Function) {
        next((cb: Function) => {
            if (res.error) {
                logger.error('Error in RPC response:\n', res);
            } else {
                logger.log(`RPC (${opts.origin}):`, req, '->', res);
            }

            cb();
        });
    };
}
