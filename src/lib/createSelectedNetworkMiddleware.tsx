import NetworkController from '../controller/NetworkController';

/**
 * Returns a middleware that appends the DApp origin to request
 *
 * @param {{ origin: string }} opts - The middleware options
 * @returns {Function}
 */
export default function createSelectedNetworkMiddleware(networkController: NetworkController) {
    return function originMiddleware(req: any, _: any, next: Function) {
        req.networkId = networkController.getSelectedNetwork().chain_id;
        next();
    };
}
