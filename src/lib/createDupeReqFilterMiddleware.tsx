import logger from '../shared/utils/logger';

/**
 * Returns a middleware that filters out requests already seen
 *
 * @returns {Function}
 */
export default function createDupeReqFilterMiddleware() {
    const processedRequestId: any[] = [];
    return function filterDuplicateRequestMiddleware(
        req: any,
        _res: any,
        next: Function,
        end: Function,
    ) {
        if (processedRequestId.indexOf(req.id) >= 0) {
            logger.log(`RPC request with id ${req.id} already seen.`);
            return end();
        }
        processedRequestId.push(req.id);
        return next();
    };
}
