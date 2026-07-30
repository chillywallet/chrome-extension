import { JsonRpcProvider } from 'ethers';

export default function createProviderMiddleware(getProvider: () => JsonRpcProvider) {
    return function providerMiddleware(req: any, res: any, next: Function, end: Function) {
        getProvider()
            .send(req.method, req.params)
            .then((result: any) => {
                res.result = result;
                return end();
            })
            .catch(e => {
                res.error = e;
                return end();
            });
    };
}
