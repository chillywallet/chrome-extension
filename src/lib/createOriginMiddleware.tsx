/**
 * Returns a middleware that appends the DApp origin to request
 *
 * @param {{ origin: string }} opts - The middleware options
 * @returns {Function}
 */
export default function createOriginMiddleware(opts: { origin: string }) {
    return function originMiddleware(req: any, _: any, next: Function) {
        req.origin = opts.origin;
        next();
    };
}
