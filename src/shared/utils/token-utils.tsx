/**
 * Gets the '_value' parameter of the given token transaction data
 * (i.e function call) per the Human Standard Token ABI, if present.
 *
 * @param {object} tokenData - ethers Interface token data.
 * @returns {string | undefined} A decimal string value.
 */

import { TransactionDescription } from '@ethersproject/abi';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import smartContractMethods from '../../lib/smartcontract-methods.json';
import { parseStandardTokenTransactionData } from '../../lib/transactions/utils';
import { convertHexToString, convertRawAmountToDecimalFormat, fromWei } from '../../lib/web3';
import { getTokenBalance } from '../../store/actions/uiActions';
import { AssetDetail, TransactionType } from '../types/Transaction';
import { NFT } from '../types/Wallet';
import logger from './logger';
/**
 * Gets either the '_tokenId' parameter or the 'id' param of the passed token transaction data.,
 * These are the parsed tokenId values returned by `parseStandardTokenTransactionData` as defined
 * in the ERC721 and ERC1155 ABIs from metamask-eth-abis (https://github.com/MetaMask/metamask-eth-abis/tree/main/src/abis)
 *
 * @param {object} tokenData - ethers Interface token data.
 * @returns {string | undefined} A decimal string value.
 */
export function getTokenIdParam(tokenData: TransactionDescription) {
    return tokenData.args?._tokenId?.toString() ?? tokenData.args?.id?.toString();
}

/**
 * Attempts to get the address parameter of the given token transaction data
 * (i.e. function call) per the Human Standard Token ABI, in the following
 * order:
 *   - The '_to' parameter, if present
 *   - The first parameter, if present
 *
 * @param {object} tokenData - ethers Interface token data.
 * @returns {string | undefined} A lowercase address string.
 */
export function getTokenAddressParam(tokenData: TransactionDescription) {
    const value = tokenData.args?._to || tokenData.args?.to || tokenData.args?.[0];
    return value?.toString().toLowerCase();
}

export function getTokenValueParam(tokenData: TransactionDescription) {
    if (tokenData.name === TransactionType.tokenMethodIncreaseAllowance) {
        return tokenData.args?.increment?.toString();
    }
    return tokenData.args?._value?.toString();
}

export async function getAssetDetails(
    tokenAddress: string,
    currentUserAddress: string,
    transactionData: string | undefined,
    nfts?: NFT[],
): Promise<AssetDetail> {
    const tokenData = parseStandardTokenTransactionData(transactionData);

    if (!tokenData) {
        throw new Error('Unable to detect valid token data');
    }

    const toAddress = getTokenAddressParam(tokenData);

    let tokenDetails;

    try {
        tokenDetails = await getTokenBalance(currentUserAddress, tokenAddress, false);
    } catch (error) {
        logger.warn(error);
        // if we can't determine any token standard or details return the data we can extract purely from the parsed transaction data
        return { toAddress };
    }
    const tokenValue = getTokenValueParam(tokenData);
    const tokenDecimals = tokenDetails && !tokenDetails.error ? tokenDetails.decimals : undefined;
    const tokenAmount =
        tokenData && tokenValue && tokenDecimals && calcTokenAmount(tokenValue, tokenDecimals);

    // else if not an NFT already in state or standard === ERC20 return tokenDetails and tokenId
    return {
        tokenAmount,
        toAddress,
        decimals: tokenDecimals,
        balance: ethers.formatUnits(tokenDetails.balance, tokenDecimals),
    };
}

export async function getNativeAssetDetails(
    tokenAddress: string,
    toAddress: string,
    tokenValue: string,
    currentUserAddress: string,
): Promise<AssetDetail> {
    let tokenDetails;

    try {
        tokenDetails = await getTokenBalance(currentUserAddress, tokenAddress, true);
    } catch (error) {
        logger.warn(error);
        return { toAddress };
    }

    const tokenDecimals = tokenDetails && !tokenDetails.error ? tokenDetails.decimals : undefined;
    const tokenAmount =
        tokenValue && tokenDecimals ? calcTokenAmount(tokenValue, tokenDecimals) : undefined;

    return {
        tokenAmount,
        toAddress,
        decimals: tokenDecimals,
        balance: ethers.formatEther(tokenDetails.balance),
    };
}

export function calcTokenAmount(value: string, decimals: number) {
    const multiplier = Math.pow(10, decimals);
    return new BigNumber(String(value)).div(multiplier);
}

export function getTxValue(transaction: any) {
    const tokenTransferHash = smartContractMethods.token_transfer.hash;

    if (transaction.data === '0x') {
        return fromWei(convertHexToString(transaction.value));
    }

    if (transaction.data?.startsWith(tokenTransferHash)) {
        const dataPayload = transaction.data.replace(tokenTransferHash, '');
        const amount = `0x${dataPayload.slice(64, 128).replace(/^0+/, '')}`;
        return convertRawAmountToDecimalFormat(convertHexToString(amount), 18);
    }
    if (transaction.data) {
        // If it's not a token transfer, let's assume it's an ETH transaction
        return transaction.value ? fromWei(convertHexToString(transaction.value)) : '0';
    }

    return '0';
}
