import { Interface, JsonRpcProvider, TransactionRequest } from 'ethers';
import { zeroAddress } from 'viem';
import { estimateGasWithPadding } from '../web3';
import { SendCallsCall } from './types';

const batchAccountAbi = [
    {
        type: 'function',
        name: 'execute',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'calls',
                type: 'tuple[]',
                components: [
                    { name: 'to', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'data', type: 'bytes' },
                ],
            },
        ],
        outputs: [],
    },
] as const;

const batchExecuteInterface = new Interface(batchAccountAbi as readonly any[]);
const GAS_PADDING_FACTOR = 1.2;

function buildBatchCalls(calls: SendCallsCall[]): {
    batchCalls: Array<{ to: string; value: bigint; data: string }>;
    totalValue: bigint;
} {
    const batchCalls: Array<{ to: string; value: bigint; data: string }> = [];
    let totalValue = 0n;

    for (const call of calls) {
        const value = call.value ? BigInt(call.value) : 0n;
        totalValue += value;
        batchCalls.push({
            to: call.to ?? zeroAddress,
            value,
            data: call.data ?? '0x',
        });
    }

    return { batchCalls, totalValue };
}

export function encodeExecuteBatch(calls: SendCallsCall[]): { data: string; totalValue: bigint } {
    const { batchCalls, totalValue } = buildBatchCalls(calls);
    const data = batchExecuteInterface.encodeFunctionData('execute', [batchCalls]);
    return { data, totalValue };
}

export function buildExecuteBatchTx(params: {
    calls: SendCallsCall[];
    from: string;
    executeAddress: string;
}): TransactionRequest {
    const { data } = encodeExecuteBatch(params.calls);
    return {
        to: params.executeAddress,
        from: params.from,
        data,
    };
}

export async function estimateExecuteBatchGas(
    provider: JsonRpcProvider,
    params: { calls: SendCallsCall[]; from: string; executeAddress: string },
): Promise<number> {
    const txForEstimate = buildExecuteBatchTx({
        calls: params.calls,
        from: params.from,
        executeAddress: params.executeAddress,
    });

    const gasWithPadding = await estimateGasWithPadding(
        {
            to: txForEstimate.to,
            data: txForEstimate.data,
            from: txForEstimate.from,
            value: txForEstimate.value,
        },
        null,
        null,
        provider,
        GAS_PADDING_FACTOR,
    );

    if (!gasWithPadding) {
        throw new Error('Failed to estimate gas');
    }

    const gas = Number(gasWithPadding);

    if (!Number.isFinite(gas) || gas <= 0) {
        throw new Error('Failed to estimate gas');
    }

    return gas;
}
