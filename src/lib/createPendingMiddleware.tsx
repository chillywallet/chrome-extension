import { createAsyncMiddleware } from 'json-rpc-engine';

export function formatTxMetaForRpcResult(txMeta: any) {
    const { r, s, v, hash, txReceipt, txParams } = txMeta;
    const {
        to,
        data,
        nonce,
        gas,
        from,
        value,
        gasPrice,
        accessList,
        maxFeePerGas,
        maxPriorityFeePerGas,
    } = txParams;

    const formattedTxMeta: any = {
        v,
        r,
        s,
        to,
        gas,
        from,
        hash,
        nonce: `${nonce}`,
        input: data || '0x',
        value: value || '0x0',
        accessList: accessList || null,
        blockHash: txReceipt?.blockHash || null,
        blockNumber: txReceipt?.blockNumber || null,
        transactionIndex: txReceipt?.transactionIndex || null,
        type: maxFeePerGas && maxPriorityFeePerGas ? '0x2' : '0x0',
    };

    if (maxFeePerGas && maxPriorityFeePerGas) {
        formattedTxMeta.gasPrice = maxFeePerGas;
        formattedTxMeta.maxFeePerGas = maxFeePerGas;
        formattedTxMeta.maxPriorityFeePerGas = maxPriorityFeePerGas;
    } else {
        formattedTxMeta.gasPrice = gasPrice;
    }

    return formattedTxMeta;
}

export function createPendingNonceMiddleware({ getPendingNonce }: { getPendingNonce: Function }) {
    return createAsyncMiddleware(async (req: any, res: any, next: Function) => {
        const { method, params } = req;
        if (method !== 'eth_getTransactionCount') {
            next();
            return;
        }
        const [param, blockRef] = params;
        if (blockRef !== 'pending') {
            next();
            return;
        }
        res.result = await getPendingNonce(param, req.networkClientId);
    });
}

export function createPendingTxMiddleware({
    getPendingTransactionByHash,
}: {
    getPendingTransactionByHash: Function;
}) {
    return createAsyncMiddleware(async (req: any, res: any, next: Function) => {
        const { method, params } = req;
        if (method !== 'eth_getTransactionByHash') {
            next();
            return;
        }
        const [hash] = params;
        const txMeta = getPendingTransactionByHash(hash);
        if (!txMeta) {
            next();
            return;
        }
        res.result = formatTxMetaForRpcResult(txMeta);
    });
}
