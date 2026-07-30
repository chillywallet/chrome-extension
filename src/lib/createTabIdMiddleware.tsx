/**
 * Returns a middleware that appends the DApp TabId to the request
 *
 * @param {{ tabId: number }} opts - The middleware options
 * @returns {Function}
 */
export default function createTabIdMiddleware(opts: { tabId: number }) {
    return function tabIdMiddleware(req: any, _: any, next: Function) {
        req.tabId = opts.tabId;
        next();
    };
}
