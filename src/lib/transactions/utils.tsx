import { Interface, TransactionDescription } from '@ethersproject/abi';
import { InternalAccount } from '@metamask/keyring-api';
import { add0x, getKnownPropertyNames, Json, type Hex } from '@metamask/utils';
import { JsonRpcProvider } from 'ethers';
import abiERC1155 from '../../lib/erc1155-abi.json';
import abiERC20 from '../../lib/erc20-abi.json';
import abiERC721 from '../../lib/erc721-abi.json';
import abiFiatTokenV2 from '../../lib/fiatTokenV2-abi.json';
import {
    InferTransactionTypeResult,
    Result,
    TransactionError,
    TransactionParams,
    TransactionType,
} from '../../shared/types/Transaction';
import { isKnownPrecompileOrSystemAddress, ZERO_CODE_VALUES } from './chain-precompile';

const ERC20Interface = new Interface(abiERC20);
const ERC721Interface = new Interface(abiERC721);
const ERC1155Interface = new Interface(abiERC1155);
const USDCInterface = new Interface(abiFiatTokenV2);

export type AddTransactionOptions = NonNullable<
    Parameters<
        (
            txParams: TransactionParams,
            options?: {
                actionId?: string;
                method?: string;
                origin?: string;
                requireApproval?: boolean | undefined;
                type?: TransactionType;
            },
        ) => Promise<Result>
    >[1]
>;

type BaseAddTransactionRequest = {
    chainId: Hex;
    networkClientId: string;
    selectedAccount: InternalAccount;
    transactionParams: TransactionParams;
};

type FinalAddTransactionRequest = BaseAddTransactionRequest & {
    transactionOptions: AddTransactionOptions;
};

export type AddTransactionRequest = FinalAddTransactionRequest & {
    waitForSubmit: boolean;
};

export type AddDappTransactionRequest = BaseAddTransactionRequest & {
    dappRequest: Record<string, any>;
};

/**
 * Ensure a hex string is of even length by adding a leading 0 if necessary.
 * Any existing `0x` prefix is preserved but is not added if missing.
 *
 * @param hex - The hex string to ensure is even.
 * @returns The hex string with an even length.
 */
export function padHexToEvenLength(hex: string) {
    const prefix = hex.toLowerCase().startsWith('0x') ? hex.slice(0, 2) : '';
    const data = prefix ? hex.slice(2) : hex;
    const evenData = data.length % 2 === 0 ? data : `0${data}`;

    return prefix + evenData;
}

// TODO: Replace `any` with type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NORMALIZERS: { [param in keyof TransactionParams]: any } = {
    data: (data: string) => add0x(padHexToEvenLength(data)),
    from: (from: string) => add0x(from).toLowerCase(),
    gas: (gas: string) => add0x(gas),
    gasLimit: (gas: string) => add0x(gas),
    gasPrice: (gasPrice: string) => add0x(gasPrice),
    nonce: (nonce: string) => add0x(nonce),
    to: (to: string) => add0x(to).toLowerCase(),
    value: (value: string) => add0x(value),
    maxFeePerGas: (maxFeePerGas: string) => add0x(maxFeePerGas),
    maxPriorityFeePerGas: (maxPriorityFeePerGas: string) => add0x(maxPriorityFeePerGas),
    estimatedBaseFee: (maxPriorityFeePerGas: string) => add0x(maxPriorityFeePerGas),
    type: (type: string) => add0x(type),
};

/**
 * Normalizes properties on transaction params.
 *
 * @param txParams - The transaction params to normalize.
 * @returns Normalized transaction params.
 */
export function normalizeTransactionParams(txParams: TransactionParams) {
    const normalizedTxParams: TransactionParams = { from: '' };

    for (const key of getKnownPropertyNames(NORMALIZERS)) {
        if (txParams[key]) {
            //@ts-ignore
            normalizedTxParams[key] = NORMALIZERS[key](txParams[key]);
        }
    }

    if (!normalizedTxParams.value) {
        normalizedTxParams.value = '0x0';
    }

    return normalizedTxParams;
}

/**
 * Checks if a transaction is EIP-1559 by checking for the existence of
 * maxFeePerGas and maxPriorityFeePerGas within its parameters.
 *
 * @param txParams - Transaction params object to add.
 * @returns Boolean that is true if the transaction is EIP-1559 (has maxFeePerGas and maxPriorityFeePerGas), otherwise returns false.
 */
export function isEIP1559Transaction(txParams: TransactionParams): boolean {
    const hasOwnProp = (obj: TransactionParams, key: string) =>
        Object.prototype.hasOwnProperty.call(obj, key);
    return hasOwnProp(txParams, 'maxFeePerGas') && hasOwnProp(txParams, 'maxPriorityFeePerGas');
}

/**
 * Normalizes properties on transaction params.
 *
 * @param error - The error to be normalize.
 * @returns Normalized transaction error.
 */
export function normalizeTxError(
    error: Error & { code?: string; value?: unknown },
): TransactionError {
    return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        rpc: isJsonCompatible(error.value) ? error.value : undefined,
    };
}

/**
 * Determines whether the given value can be encoded as JSON.
 *
 * @param value - The value.
 * @returns True if the value is JSON-encodable, false if not.
 */
function isJsonCompatible(value: unknown): value is Json {
    try {
        JSON.parse(JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

/**
 * Determines the type of the transaction by analyzing the txParams.
 * It will never return TRANSACTION_TYPE_CANCEL or TRANSACTION_TYPE_RETRY as these
 * represent specific events that we specify manually at transaction creation.
 *
 * @param txParams - Parameters for the transaction.
 * @param ethQuery - EthQuery instance.
 * @returns A object with the transaction type and the contract code response in Hex.
 */
export async function determineTransactionType(
    txParams: TransactionParams,
    provider: JsonRpcProvider,
): Promise<InferTransactionTypeResult> {
    const { data, to } = txParams;

    if (data && !to) {
        return { type: TransactionType.deployContract, getCodeResponse: undefined };
    }

    const { contractCode: getCodeResponse, isContractLikeAddress } = await readAddressAsContract(
        provider,
        to as string,
    );

    if (!isContractLikeAddress) {
        return { type: TransactionType.simpleSend, getCodeResponse };
    }

    const hasValue = Number(txParams.value ?? '0') !== 0;

    const contractInteractionResult = {
        type: TransactionType.contractInteraction,
        getCodeResponse,
    };

    if (!data || hasValue) {
        return contractInteractionResult;
    }

    const name = parseStandardTokenTransactionData(data)?.name;

    if (!name) {
        return contractInteractionResult;
    }

    const tokenMethodName = [
        TransactionType.tokenMethodApprove,
        TransactionType.tokenMethodSetApprovalForAll,
        TransactionType.tokenMethodTransfer,
        TransactionType.tokenMethodTransferFrom,
        TransactionType.tokenMethodSafeTransferFrom,
        TransactionType.tokenMethodIncreaseAllowance,
    ].find(methodName => methodName.toLowerCase() === (name as string).toLowerCase());

    if (tokenMethodName) {
        return { type: tokenMethodName, getCodeResponse };
    }

    return contractInteractionResult;
}

type ReadAddressAsContractResult = {
    contractCode: string | null;
    isContractLikeAddress: boolean;
    isPrecompileOrSystemAddress: boolean;
    contractAddressType: 'deployed_contract' | 'precompile_or_system_contract' | 'eoa_or_unknown';
};

/**
 * Reads an Ethereum address and determines if it is a contract address.
 *
 * @param provider - The Ethereum provider used to interact with the Ethereum blockchain.
 * @param address - The Ethereum address.
 * @param chainId - The chain ID.
 * @returns An object containing the contract code, a boolean indicating if it is a contract address, a boolean indicating if it is a precompile or system address, and the contract address type.
 */
export async function readAddressAsContract(
    provider: JsonRpcProvider,
    address: string,
    chainId?: number,
): Promise<ReadAddressAsContractResult> {
    let contractCode: string | null;

    try {
        contractCode = await provider.getCode(address);
    } catch {
        contractCode = null;
    }

    const hasDeployedCode = !!contractCode && !ZERO_CODE_VALUES.has(contractCode.toLowerCase());

    let resolvedChainId = chainId;

    if (!resolvedChainId) {
        try {
            const network = await provider.getNetwork();
            resolvedChainId = Number(network.chainId);
        } catch {
            resolvedChainId = undefined;
        }
    }

    const isPrecompileOrSystemAddress =
        !!resolvedChainId && isKnownPrecompileOrSystemAddress(resolvedChainId, address);

    return {
        contractCode,
        isContractLikeAddress: hasDeployedCode || isPrecompileOrSystemAddress,
        isPrecompileOrSystemAddress,
        contractAddressType: hasDeployedCode
            ? 'deployed_contract'
            : isPrecompileOrSystemAddress
              ? 'precompile_or_system_contract'
              : 'eoa_or_unknown',
    };
}

/**
 * Attempts to decode transaction data using ABIs for three different token standards: ERC20, ERC721, ERC1155.
 * The data will decode correctly if the transaction is an interaction with a contract that matches one of these
 * contract standards
 *
 * @param data - Encoded transaction data.
 * @returns A representation of an ethereum contract call.
 */
export function parseStandardTokenTransactionData(
    data?: string,
): TransactionDescription | undefined {
    if (!data) {
        return undefined;
    }

    try {
        return ERC20Interface.parseTransaction({ data });
    } catch {
        // ignore and next try to parse with erc721 ABI
    }

    try {
        return ERC721Interface.parseTransaction({ data });
    } catch {
        // ignore and next try to parse with erc1155 ABI
    }

    try {
        return ERC1155Interface.parseTransaction({ data });
    } catch {
        // ignore and return undefined
    }

    try {
        return USDCInterface.parseTransaction({ data });
    } catch {
        // ignore and return undefined
    }

    return undefined;
}
