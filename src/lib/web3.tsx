import { BigNumberish, BigNumber as EtherBigNumber } from '@ethersproject/bignumber';
import { parseEther } from '@ethersproject/units';
import BigNumber from 'bignumber.js';
import { Block, JsonRpcProvider, TransactionRequest } from 'ethers';
import { replace } from 'lodash';
import { getErrorMessage } from '../api/graphQL/BaseRequest';
import {
    Asset,
    AssetType,
    NewTransaction,
    TransactionDetailsReturned,
} from '../shared/types/Wallet';
import logger from '../shared/utils/logger';
import smartContractMethods from './smartcontract-methods.json';

/**
 * The format of transaction details returned by functions such as `getTxDetails`.
 */

export function sanitizeHex(hex: string): string {
    hex = hex.substring(0, 2) === '0x' ? hex.substring(2) : hex;
    if (hex === '') {
        return '';
    }
    hex = hex.length % 2 !== 0 ? '0' + hex : hex;
    return '0x' + hex;
}

export function convertAmountToRawNumber(value: string | number, decimals = 18): string {
    return new BigNumber(`${value}`).times(new BigNumber('10').pow(decimals)).toString();
}

/**
 * Converts a number to a hex string.
 * @param value The number.
 * @return The hex string.
 */
export const toHex = (value: BigNumberish): string => EtherBigNumber.from(value).toHexString();

/**
 * Converts a number to a hex string.
 * @param value The number.
 * @return The hex string.
 */
export const hexToNumber = (hex: string): number => EtherBigNumber.from(hex).toNumber();

/**
 * @desc convert from ether to wei
 * @param value The value in ether.
 * @return The value in wei.
 */
export const toWei = (ether: string): string => {
    const result = parseEther(ether);
    return result.toString();
};

/**
 * @desc Gets transaction details for a new transaction.
 * @param transaction The new transaction. In particular, the `from`, `to`,
 * `gasPrice`, `gasLimit`, `amount` fields from a `NewTransaction` are required,
 * as well as an optional `data` field similar to a `TransactionRequest`.
 * @return The transaction details.
 */
export const getTxDetails = async (
    transaction: NewTransaction | TransactionDetailsReturned,
): Promise<TransactionRequest> => {
    const { to } = transaction;
    const data = transaction?.data ?? '0x';
    const value = transaction.amount ? toHex(transaction.amount) : '0x0';
    const gasLimit = transaction.gasLimit ? toHex(transaction.gasLimit) : undefined;
    const baseTx = {
        data,
        gasLimit,
        to,
        value,
    };

    if (transaction.maxFeePerGas && transaction.maxPriorityFeePerGas) {
        return {
            ...baseTx,
            maxFeePerGas: transaction.maxFeePerGas,
            maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        };
    } else if (transaction.gasPrice) {
        return {
            ...baseTx,
            gasPrice: transaction.gasPrice,
        };
    } else {
        throw new Error('Gas price is missing.');
    }
};

/**
 * @desc Gets transaction details for a new transfer NFT transaction.
 * @param transaction The new transaction. The `asset`, `from`, `to`,
 * `gasPrice`, and `gasLimit` fields from a `NewTransaction` are required.
 * @return The transaction details.
 * @throws If the recipient is invalid or could not be found.
 */
export const getTransferNftTransaction = async (
    transaction: NewTransaction,
): Promise<TransactionDetailsReturned> => {
    const recipient = transaction.to;

    if (!recipient) {
        throw new Error(`Invalid recipient "${transaction.to}"`);
    }

    const { from } = transaction;
    const contractAddress = transaction.asset.address;
    const data = getDataForNftTransfer(from, recipient, transaction.asset);
    return {
        data,
        from,
        gasLimit: transaction.gasLimit?.toString(),
        to: contractAddress,
        maxFeePerGas: transaction.maxFeePerGas,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        gasPrice: transaction.gasPrice,
    };
};

/**
 * @desc Gets transaction details for a new transfer token transaction.
 * @param transaction The new transaction. The `asset`, `from`, `to`, `amount`,
 * `gasPrice`, and `gasLimit` fields from a `NewTransaction` are required.
 * @return The transaction details.
 */
export const getTransferTokenTransaction = async (
    transaction: NewTransaction,
): Promise<TransactionDetailsReturned> => {
    const value = transaction.amount;
    const recipient = transaction.to;
    const data = getDataForTokenTransfer(value, recipient);
    return {
        data,
        from: transaction.from,
        gasLimit: transaction.gasLimit?.toString(),
        to: transaction.asset.address,
        maxFeePerGas: transaction.maxFeePerGas,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        gasPrice: transaction.gasPrice,
    };
};

/**
 * @desc Transforms a new transaction into signable transaction.
 * @param transaction The new transaction.
 * @return The transaction details.
 */
export const createSignableTransaction = async (
    transaction: NewTransaction,
): Promise<TransactionRequest> => {
    if (transaction.asset.type === AssetType.native) {
        return getTxDetails(transaction);
    }

    const isNft = transaction.asset.type === AssetType.nft;
    const result = isNft
        ? await getTransferNftTransaction(transaction)
        : await getTransferTokenTransaction(transaction);

    return getTxDetails(result);
};

/**
 * @desc Returns a transaction data string for an NFT transfer.
 * @param from The sender's address.
 * @param to The recipient's address.
 * @param asset The asset to transfer.
 * @return The data string.
 */
export const getDataForNftTransfer = (from: string, to: string, asset: Asset) => {
    if (asset.nftType === 'ERC1155') {
        const transferMethodHash = smartContractMethods.erc1155_safe_transfer_from.hash;
        const data = getDataString(transferMethodHash, [
            removeHexPrefix(from),
            removeHexPrefix(to),
            convertStringToHex(asset.id),
            convertStringToHex('1'),
            convertStringToHex('160'),
            convertStringToHex('0'),
        ]);
        return data;
    }

    const transferMethod = smartContractMethods.erc721_transfer;
    const data = getDataString(transferMethod.hash, [
        removeHexPrefix(from),
        removeHexPrefix(to),
        convertStringToHex(asset.id),
    ]);

    return data;
};

/**
 * @desc Generates a transaction data string for a token transfer.
 * @param value The value to transfer.
 * @param to The recipient address.
 * @return The data string for the transaction.
 */
export const getDataForTokenTransfer = (value: string, to: string): string => {
    const transferMethodHash = smartContractMethods.token_transfer.hash;
    const data = getDataString(transferMethodHash, [
        removeHexPrefix(to),
        convertStringToHex(value),
    ]);
    return data;
};

/**
 * @desc remove hex prefix
 * @param  {String} hex
 * @return {String}
 */
const removeHexPrefix = (hex: string) => replace(hex.toLowerCase(), '0x', '');

/**
 * @desc pad string to specific width and padding
 * @param  {String} n
 * @param  {Number} width
 * @param  {String} z
 * @return {String}
 */
const padLeft = (n: string, width: number, z = '0') => {
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};

/**
 * @desc get ethereum contract call data string
 * @param  {String} func
 * @param  {Array}  arrVals
 * @return {String}
 */
const getDataString = (func: string, arrVals: string[]) => {
    let val = '';
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < arrVals.length; i++) val += padLeft(arrVals[i], 64);
    const data = func + val;
    return data;
};

/**
 * @desc convert hex to number string
 * @param  {String} hex
 * @return {String}
 */
//@ts-ignore
export const convertHexToString = (hex: BigNumberish): string => new BigNumber(hex).toFixed();

export const convertStringToHex = (stringToConvert: string): string =>
    new BigNumber(stringToConvert).toString(16);

export const fromWei = (number: BigNumberish): string =>
    convertRawAmountToDecimalFormat(number, 18);

/**
 * @desc convert from raw amount to decimal format
 */
export const convertRawAmountToDecimalFormat = (
    value: BigNumberish,
    decimals: number = 18,
    //@ts-ignore
): string => new BigNumber(value).dividedBy(new BigNumber(10).pow(decimals)).toFixed();

/**
 * @desc Estimates the gas limit for a transaction.
 * @param options The `asset`, `address`, `recipient`, and `amount` for the
 * transaction.
 * @param addPadding Whether or not to add padding to the gas limit, defaulting
 * to `false`.
 * @param provider The RCP provider to use.
 * @param network The network to use, defaulting to `Network.mainnet`.
 * @returns The estimated gas limit.
 */
export const estimateGasLimit = async (
    {
        asset,
        address,
        recipient,
        amount,
    }: {
        asset: Asset;
        address: string;
        recipient: string;
        amount: string;
    },
    provider: JsonRpcProvider,
    padding: number = 0,
): Promise<string | null> => {
    const estimateGasData = await buildTransaction({ address, amount, asset, recipient });

    if (padding > 0) {
        return estimateGasWithPadding(estimateGasData, null, null, provider, padding);
    } else {
        return estimateGas(estimateGasData, provider);
    }
};

/**
 * @desc Builds a transaction request object.
 * @param [{address, amount, asset, gasLimit, recipient}] The transaction
 * initialization details.
 * @param provider The RCP provider to use.
 * @param network The network for the transaction
 * @return The transaction request.
 */
export const buildTransaction = async ({
    address,
    amount,
    asset,
    gasLimit,
    recipient,
}: {
    asset: Asset;
    address: string;
    recipient: string;
    amount: string;
    gasLimit?: string;
}): Promise<TransactionRequest> => {
    const _recipient = recipient;
    let txData: TransactionRequest = {
        data: '0x',
        from: address,
        to: _recipient,
        value: amount,
    };
    if (asset.type === AssetType.nft) {
        const contractAddress = asset.address;
        const data = getDataForNftTransfer(address, _recipient, asset);
        txData = {
            data,
            from: address,
            to: contractAddress,
        };
    } else if (asset.type === AssetType.token) {
        const transferData = getDataForTokenTransfer(amount, _recipient);
        txData = {
            data: transferData,
            from: address,
            to: asset.address,
            value: '0x0',
        };
    }
    return { ...txData, gasLimit };
};

/**
 * @desc estimate gas limit
 * @param estimateGasData The transaction request to use for the estimate.
 * @param provider The RCP provider to use.
 * @return The gas limit, or `null` if an error occurs.
 */
export const estimateGas = async (
    estimateGasData: TransactionRequest,
    provider: JsonRpcProvider,
): Promise<string | null> => {
    try {
        const p = provider;
        const gasLimit = await p?.estimateGas(estimateGasData);
        return gasLimit?.toString() ?? null;
    } catch (error) {
        logger.log('estimateGas error', error);
        return null;
    }
};

/**
 * @desc Estimates gas for a transaction with a padding multiple.
 * @param txPayload The tranasaction payload
 * @param contractCallEstimateGas An optional function to use for gas estimation,
 * defaulting to `null`.
 * @param callArguments Arbitrary arguments passed as the first parameters
 * of `contractCallEstimateGas`, if provided.
 * @param provider The RCP provider to use.
 * @param paddingFactor The padding applied to the gas limit.
 * @return The gas estimation as a string, or `null` if estimation failed
 */
export async function estimateGasWithPadding(
    txPayload: TransactionRequest,
    contractCallEstimateGas: ((...args: any[]) => Promise<bigint>) | null,
    callArguments: any[] | null = null,
    provider: JsonRpcProvider,
    paddingFactor: number = 1.1,
): Promise<string | null> {
    const p = provider;
    if (!p) {
        return null;
    }

    try {
        const txPayloadToEstimate: TransactionRequest & { gas?: string } = {
            ...txPayload,
        };

        // `getBlock`'s typing requires a parameter, but passing no parameter
        // works as intended and returns the gas limit.
        const { gasLimit } = await (p.getBlock as () => Promise<Block>)();

        const { to, data } = txPayloadToEstimate;

        // 1 - Check if the receiver is a contract
        const code = to ? await p.getCode(to) : undefined;
        // 2 - if it's not a contract AND it doesn't have any data use the default gas limit
        if ((!contractCallEstimateGas && !to) || (to && !data && (!code || code === '0x'))) {
            logger.log('⛽ Skipping estimates, using default', 21000);
            return '21000';
        }

        logger.log('⛽ Calculating safer gas limit for last block');
        // 3 - If it is a contract, call the RPC method `estimateGas` with a safe value
        const saferGasLimit = fraction(gasLimit.toString(), 19, 20);
        logger.log('⛽ safer gas limit for last block is', saferGasLimit);

        txPayloadToEstimate[contractCallEstimateGas ? 'gasLimit' : 'gas'] = toHex(saferGasLimit);

        const estimatedGas = await (contractCallEstimateGas
            ? contractCallEstimateGas(...(callArguments ?? []), txPayloadToEstimate)
            : p.estimateGas(txPayloadToEstimate));

        const lastBlockGasLimit = addBuffer(gasLimit.toString(), 0.9);
        const paddedGas = addBuffer(estimatedGas.toString(), paddingFactor.toString());
        logger.log('⛽ GAS CALCULATIONS!', {
            estimatedGas: estimatedGas.toString(),
            gasLimit: gasLimit.toString(),
            lastBlockGasLimit: lastBlockGasLimit,
            paddedGas: paddedGas,
        });

        // If the safe estimation is above the last block gas limit, use it
        if (greaterThan(estimatedGas.toString(), lastBlockGasLimit)) {
            logger.log('⛽ returning orginal gas estimation', estimatedGas.toString());
            return estimatedGas.toString();
        }
        // If the estimation is below the last block gas limit, use the padded estimate
        if (greaterThan(lastBlockGasLimit, paddedGas)) {
            logger.log('⛽ returning padded gas estimation', paddedGas);
            return paddedGas;
        }
        // otherwise default to the last block gas limit
        logger.log('⛽ returning last block gas limit', lastBlockGasLimit);
        return lastBlockGasLimit;
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        throw new Error(errorMessage);
    }
}

export const fraction = (
    target: BigNumberish,
    numerator: BigNumberish,
    denominator: BigNumberish,
): string => {
    if (!target || !numerator || !denominator) return '0';
    //@ts-ignore
    return new BigNumber(target).times(numerator).dividedBy(denominator).toFixed(0);
};

export const addBuffer = (numberOne: BigNumberish, buffer: BigNumberish = '1.2'): string =>
    //@ts-ignore
    new BigNumber(numberOne).times(buffer).toFixed(0);

export const greaterThan = (numberOne: BigNumberish, numberTwo: BigNumberish): boolean =>
    //@ts-ignore
    new BigNumber(numberOne).gt(numberTwo);

/**
 * @desc Sends an arbitrary RCP call using a given provider, or the default
 * cached provider.
 * @param payload The payload, including a method and parameters, based on
 * the Ethers.js `JsonRpcProvider.send` arguments.
 * @param provider The provider to use.
 * @return The response from the `JsonRpcProvider.send` call.
 */
export const sendRpcCall = async (
    payload: {
        method: string;
        params: any[];
    },
    provider: JsonRpcProvider,
): Promise<any> => provider.send(payload.method, payload.params);
