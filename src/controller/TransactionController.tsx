import { ChainConfig, Common, Hardfork } from '@ethereumjs/common';
import { TransactionFactory, TypedTransaction } from '@ethereumjs/tx';
import { bufferToHex } from '@ethereumjs/util';
import { BaseController, RestrictedControllerMessenger } from '@metamask/base-controller';
import { ApprovalType, convertHexToDecimal } from '@metamask/controller-utils';
import { providerErrors, rpcErrors } from '@metamask/rpc-errors';
import { add0x, Hex, hexToNumber } from '@metamask/utils';
import { Mutex } from 'async-mutex';
import { errorCodes } from 'eth-rpc-errors';
import {
    Contract,
    hexlify,
    JsonRpcProvider,
    Log,
    TransactionRequest,
    TransactionResponse,
    Wallet,
    ZeroAddress,
} from 'ethers';
import EventEmitter from 'events';
import { cloneDeep, merge } from 'lodash';
import { v1 as random } from 'uuid';
import { TypedData, TypedDataDefinition } from 'viem';
import { getErrorMessage } from '../api/graphQL/BaseRequest';
import { getCurrentChainByChainId, getCurrentChains } from '../lib/ChainsUtils';
import { buildExecuteBatchTx, estimateExecuteBatchGas } from '../lib/eip5792/batchExecuteContract';
import { getCallBatchStatus, setCallBatchStatus } from '../lib/eip5792/callBatchStore';
import { getBatchCallsContractAddress } from '../lib/eip5792/capabilities';
import { validateWalletSendCallsPreflight } from '../lib/eip5792/sendCalls';
import {
    CallBatchStatus,
    CallBatchStatusCode,
    SendCallsParams,
    WalletSendCallsApprovalValue,
} from '../lib/eip5792/types';
import erc20ABI from '../lib/erc20-abi.json';
import erc721ABI from '../lib/erc721-abi.json';
import { LEDGER_ERR_GENERIC_FALLBACK } from '../lib/ledger/ledgerErrorMessages';
import { normalizeLedgerDeviceErrorMessage } from '../lib/ledger/ledgerNormalizeDeviceError';
import {
    determineTransactionType,
    normalizeTransactionParams,
    normalizeTxError,
    readAddressAsContract,
} from '../lib/transactions/utils';
import { validateTransactionOrigin, validateTxParams } from '../lib/transactions/validation';
import { getGasData, getTransactionErrorMessage, retryFunc } from '../lib/WalletUtils';
import {
    createSignableTransaction,
    estimateGasLimit,
    estimateGasWithPadding,
    toHex,
} from '../lib/web3';
import { BALANCE_CACHE_INTERVAL, ORIGIN_CHILLY } from '../shared/constants/app';
import { UNIT_256_MAX_VALUE } from '../shared/constants/swap';
import ErrorMessages from '../shared/messages/ErrorMessages';
import { ChainData } from '../shared/types/Chain';
import {
    DappSuggestedGasFees,
    Result,
    TransactionEnvelopeType,
    TransactionMeta,
    TransactionParams,
    TransactionStatus,
    TransactionType,
} from '../shared/types/Transaction';
import {
    Asset,
    GasInfo,
    ChillyAccount,
    NewTransaction,
    TransactionRequestParam,
} from '../shared/types/Wallet';
import logger from '../shared/utils/logger';
import { RateLimiters } from '../shared/utils/rateLimiter';
import {
    AccountsControllerGetAccountByAddressAction,
    AccountsControllerGetSelectedAccountAction,
} from './AccountController';
import { AcceptResultCallbacks, AddApprovalRequest, AddResult } from './ApprovalController';
import {
    KeyringControllerGetKeyringForAccountAction,
    KeyringControllerSendTransactionUsingViemAction,
    KeyringControllerSignAuthorizationAction,
    KeyringControllerSignTypedMessageUsingViemAction,
    KeyringTypes,
} from './KeyringController';
import { NetworkControllerGetCurrentProviderAction } from './NetworkController';

const controllerName = 'TransactionController';

export const HARDFORK = Hardfork.London;

export type TransactionControllerState = {
    rpcTransactions: TransactionMeta[];
    decimalsData: { [key: number]: { [key: string]: number } };
    balanceData: {
        [key: string]: { [key: number]: { [key: string]: { value: string; timestamp: number } } };
    };
    nativeTokenBalance: { [key: string]: { [key: string]: number } };
};

const defaultState: TransactionControllerState = {
    rpcTransactions: [],
    decimalsData: {},
    balanceData: {},
    nativeTokenBalance: {},
};

export type TransactionControllerUnapprovedTransactionAddedEvent = {
    type: `${typeof controllerName}:unapprovedTransactionAdded`;
    payload: [transactionMeta: TransactionMeta];
};

export type TransactionControllerTransactionApprovedEvent = {
    type: `${typeof controllerName}:transactionApproved`;
    payload: [
        {
            transactionMeta: TransactionMeta;
            actionId?: string;
        },
    ];
};

export type TransactionControllerTransactionFailedEvent = {
    type: `${typeof controllerName}:transactionFailed`;
    payload: [
        {
            actionId?: string;
            error: string;
            transactionMeta: TransactionMeta;
        },
    ];
};

export type TransactionControllerTransactionRejectedEvent = {
    type: `${typeof controllerName}:transactionRejected`;
    payload: [
        {
            transactionMeta: TransactionMeta;
            actionId?: string;
        },
    ];
};

export type TransactionControllerTransactionFinishedEvent = {
    type: `${typeof controllerName}:transactionFinished`;
    payload: [transactionMeta: TransactionMeta];
};

export type TransactionControllerTransactionStatusUpdatedEvent = {
    type: `${typeof controllerName}:transactionStatusUpdated`;
    payload: [
        {
            transactionMeta: TransactionMeta;
        },
    ];
};

export type TransactionControllerTransactionSubmittedEvent = {
    type: `${typeof controllerName}:transactionSubmitted`;
    payload: [
        {
            transactionMeta: TransactionMeta;
            actionId?: string;
        },
    ];
};

export type AllowedActions =
    | AccountsControllerGetSelectedAccountAction
    | AccountsControllerGetAccountByAddressAction
    | AddApprovalRequest
    | KeyringControllerGetKeyringForAccountAction
    | KeyringControllerSignAuthorizationAction
    | KeyringControllerSignTypedMessageUsingViemAction
    | KeyringControllerSendTransactionUsingViemAction
    | NetworkControllerGetCurrentProviderAction;

export type AllowedEvents = never;

export type TransactionControllerEvents =
    | TransactionControllerUnapprovedTransactionAddedEvent
    | TransactionControllerTransactionApprovedEvent
    | TransactionControllerTransactionFailedEvent
    | TransactionControllerTransactionFinishedEvent
    | TransactionControllerTransactionRejectedEvent
    | TransactionControllerTransactionStatusUpdatedEvent
    | TransactionControllerTransactionSubmittedEvent;

export type TransactionControllerActions = never;

export type TransactionControllerMessenger = RestrictedControllerMessenger<
    typeof controllerName,
    TransactionControllerActions | AllowedActions,
    TransactionControllerEvents | AllowedEvents,
    AllowedActions['type'],
    AllowedEvents['type']
>;

export enum ApprovalState {
    Approved = 'approved',
    NotApproved = 'not-approved',
}

type Props = {
    state: TransactionControllerState;
    messenger: TransactionControllerMessenger;
    sign: (
        transaction: TypedTransaction,
        from: string,
        opts?: Record<string, unknown> | undefined,
    ) => Promise<TypedTransaction>;
    getPrivateKey: (address: string) => Promise<string>;
    getPermittedAccounts: (origin: string) => Promise<string[]>;
    getSelectedNetwork: () => ChainData;
    getProviderByChainId: (chainId: number) => JsonRpcProvider;
    getAccountBySmartAddress: (address: string) => ChillyAccount | undefined;
};
export default class TransactionController extends BaseController<
    typeof controllerName,
    TransactionControllerState,
    TransactionControllerMessenger
> {
    sign: (
        transaction: TypedTransaction,
        from: string,
        opts?: Record<string, unknown> | undefined,
    ) => Promise<TypedTransaction>;

    #getPrivateKey: (address: string) => Promise<string>;
    #getPermittedAccounts: (origin: string) => Promise<string[]>;
    #getSelectedNetwork: () => ChainData;
    #getProviderByChainId: (chainId: number) => JsonRpcProvider;
    #getAccountBySmartAddress: (address: string) => ChillyAccount | undefined;

    #internalEvents = new EventEmitter();
    private readonly approvingTransactionIds: Set<string> = new Set();
    private readonly mutex = new Mutex();
    private readonly signAbortCallbacks: Map<string, () => void> = new Map();

    constructor(opts: Props) {
        super({
            name: controllerName,
            metadata: {
                rpcTransactions: {
                    persist: true,
                    anonymous: false,
                },
                decimalsData: {
                    persist: true,
                    anonymous: false,
                },
                balanceData: {
                    persist: true,
                    anonymous: false,
                },
                nativeTokenBalance: {
                    persist: true,
                    anonymous: false,
                },
            },
            messenger: opts.messenger,
            state: {
                ...defaultState,
                ...opts.state,
            },
        });

        this.sign = opts.sign;
        this.#getPrivateKey = opts.getPrivateKey;
        this.#getPermittedAccounts = opts.getPermittedAccounts;
        this.#getSelectedNetwork = opts.getSelectedNetwork;
        this.#getProviderByChainId = opts.getProviderByChainId;
        this.#getAccountBySmartAddress = opts.getAccountBySmartAddress;

        this.#registerMessageHandlers();
    }

    async approveAllowance(
        spenderAddress: string,
        walletAddress: string,
        tokenAddress: string,
        spenderAmount: string,
        network: ChainData,
        gasInfo: GasInfo,
        infiniteApproval: boolean,
    ): Promise<TransactionResponse> {
        const provider = this.#getProviderByChainId(network.chain_id);
        const amount = infiniteApproval ? BigInt(UNIT_256_MAX_VALUE) : BigInt(spenderAmount);

        if (await this.#isHardwareAccount(walletAddress)) {
            const contract = this.#getERC20Contract(tokenAddress, provider);
            const populated = await contract
                .getFunction('approve')
                .populateTransaction(spenderAddress, amount, {
                    from: walletAddress,
                });

            const gasLimitStr = await this.estimateGasAllowance(
                spenderAddress,
                tokenAddress,
                infiniteApproval ? null : spenderAmount,
                walletAddress,
            );

            const overrides = getGasData(gasInfo);
            const transaction: TransactionRequest = {
                to: tokenAddress,
                data: populated.data!,
                value: populated.value ?? 0n,
                from: walletAddress,
                chainId: BigInt(network.chain_id),
                gasLimit: gasLimitStr ? BigInt(gasLimitStr) : undefined,
                ...overrides,
            };

            return await this.newSendTransaction(walletAddress, { transaction }, false);
        }

        return new Promise<TransactionResponse>((resolve, reject) => {
            this.#loadWallet(walletAddress, provider).then(async _wallet => {
                if (_wallet) {
                    try {
                        const contract = this.#getERC20Contract(tokenAddress);
                        const contractWithSigner = contract.connect(_wallet);

                        const overrides = getGasData(gasInfo);

                        const approveFunc = contractWithSigner.getFunction('approve');
                        const tx = await approveFunc(spenderAddress, amount, overrides);
                        resolve(tx);
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    reject(new Error(ErrorMessages.CAN_NOT_LOAD_WALLET));
                }
            });
        });
    }

    async checkAllowance(
        spenderAddress: string,
        walletAddress: string,
        tokenAddress: string,
        spenderAmount: string | null,
    ) {
        // Get contract instance for ERC20 token
        const contract = this.#getERC20Contract(tokenAddress);

        // Convert spender amount to BigNumber
        const amount = spenderAmount ? BigInt(spenderAmount) : BigInt(UNIT_256_MAX_VALUE);

        // Check current allowance
        const allowance = (await contract.allowance(walletAddress, spenderAddress)) as bigint;

        // Check if the current allowance is less than the spenderAmount
        if (allowance < amount) {
            return false;
        }

        return true;
    }

    async estimateGasAllowance(
        spenderAddress: string,
        tokenAddress: string,
        spenderAmount: string | null,
        walletAddress: string,
    ) {
        // Get contract instance for ERC20 token
        const contract = this.#getERC20Contract(tokenAddress);

        // Convert spender amount to BigNumber
        const amount = spenderAmount ? spenderAmount : BigInt(UNIT_256_MAX_VALUE);

        const approveFunc = contract.getFunction('approve');
        const unsignedTx = await approveFunc.populateTransaction(spenderAddress, amount, {
            from: walletAddress,
        });

        const gasLimit = await this.#getCurrentProvider().estimateGas(unsignedTx);
        return gasLimit?.toString() ?? null;
    }

    estimateGasLimit(
        asset: Asset,
        address: string,
        recipient: string,
        amount: string,
        padding?: number,
    ) {
        return estimateGasLimit(
            {
                asset,
                address,
                recipient,
                amount,
            },
            this.#getCurrentProvider(),
            padding,
        );
    }

    /**
     * Estimates the gas for a transaction with a padding factor.
     * @param txParams - The transaction parameters to estimate the gas for.
     * @returns The estimated gas limit.
     */
    async estimateGas(txParams: TransactionParams) {
        try {
            const request = this.#convertTransactionParamsToRequest(txParams);
            const gasLimit = await this.#getCurrentProvider().estimateGas(request);
            const paddingPercent = this.#getSelectedNetwork().gasPadding ?? 110;

            if (!gasLimit) return null;

            logger.log('⛽ Estimated gas limit', gasLimit);
            // paddingPercent: 110 → +10%, 100 → no padding
            const padded = (gasLimit * BigInt(paddingPercent)) / 100n;

            logger.log('⛽ Padded gas limit', paddingPercent, padded);

            return padded.toString();
        } catch (e: any) {
            const message = getErrorMessage(e);
            throw new Error(message);
        }
    }

    async estimateWalletSendCallsGas(payload: SendCallsParams, from: string): Promise<number> {
        const selectedNetwork = this.#getSelectedNetwork();
        const preflight = validateWalletSendCallsPreflight(payload, selectedNetwork.chain_id);

        if (!preflight.ok) {
            throw new Error(preflight.message);
        }

        const provider = this.#getProviderByChainId(preflight.chainIdNum);
        const { isContractLikeAddress } = await readAddressAsContract(provider, from);
        const isEoa = !isContractLikeAddress;

        if (payload.atomicRequired && !isEoa) {
            return await estimateExecuteBatchGas(provider, {
                calls: payload.calls,
                from,
                executeAddress: from,
            });
        }

        let total = 0;
        for (const call of payload.calls) {
            const rawValue = call.value;
            const valueField =
                rawValue === undefined || rawValue === null
                    ? '0x0'
                    : typeof rawValue === 'string'
                      ? rawValue
                      : toHex(rawValue);

            const txForEstimate: TransactionRequest = {
                from,
                to: call.to ?? ZeroAddress,
                data: call.data ?? '0x',
                value: valueField === '0x' ? '0x0' : valueField,
            };

            const gasLimitStr = await estimateGasWithPadding(txForEstimate, null, null, provider);
            total += gasLimitStr ? Math.max(21000, Math.ceil(Number(gasLimitStr))) : 21000;
        }

        return Math.max(total, 21000);
    }

    async executeWalletSendCalls(opts: {
        payload: SendCallsParams;
        from: string;
        gas?: WalletSendCallsApprovalValue;
    }): Promise<string> {
        const { payload, from, gas } = opts;
        const selectedNetwork = this.#getSelectedNetwork();
        const preflight = validateWalletSendCallsPreflight(payload, selectedNetwork.chain_id);

        if (!preflight.ok) {
            throw new Error(preflight.message);
        }

        const smartAccount = this.#getAccountBySmartAddress(from);

        if (smartAccount) {
            throw new Error('Smart Wallet does not support wallet_sendCalls batch');
        }

        const provider = this.#getProviderByChainId(preflight.chainIdNum);
        const existingWallet = await this.#loadWallet(from, provider);

        if (!existingWallet) {
            throw new Error(ErrorMessages.CAN_NOT_LOAD_WALLET);
        }

        const batchId = random();
        const chainIdStr = toHex(preflight.chainIdNum);
        const pendingAtomic = payload.atomicRequired === true;
        const batchContract = pendingAtomic
            ? getBatchCallsContractAddress(preflight.chainIdNum)
            : undefined;
        let gasLimitNum = gas?.gasLimit ?? 0;

        await setCallBatchStatus(batchId, {
            version: payload.version,
            chainId: chainIdStr,
            id: batchId,
            status: CallBatchStatusCode.Pending,
            atomic: pendingAtomic,
        });

        try {
            const gasInfo = gas?.gasInfo ?? {};

            if (pendingAtomic) {
                const { isContractLikeAddress } = await readAddressAsContract(provider, from);
                const isEoa = !isContractLikeAddress;
                let receipt: Awaited<ReturnType<TransactionResponse['wait']>> | null = null;

                if (isEoa) {
                    const chain = getCurrentChainByChainId(preflight.chainIdNum);

                    if (!chain?.viemChain) {
                        throw new Error('Chain not found or viemChain not configured');
                    }

                    // For EIP-7702, when sender == authority, authorization nonce must be tx nonce + 1.
                    const txNonce = await provider.getTransactionCount(from, 'pending');
                    const authorization = await this.messagingSystem.call(
                        'KeyringController:signAuthorization',
                        from,
                        batchContract as Hex,
                        preflight.chainIdNum,
                        txNonce + 1,
                    );

                    const txHash = await this.messagingSystem.call(
                        'KeyringController:sendTransactionUsingViem',
                        from,
                        from,
                        [authorization],
                        chain.viemChain,
                    );

                    await provider.waitForTransaction(txHash);

                    const isContract = await this.checkContract(from);

                    if (!isContract) {
                        throw new Error('Account was not delegated to the EIP-7702 contract');
                    }

                    // Reset gas limit to estimate the gas for the execute batch tx
                    gasLimitNum = 0;
                }

                if (gasLimitNum === 0) {
                    gasLimitNum = await estimateExecuteBatchGas(provider, {
                        calls: payload.calls,
                        from,
                        executeAddress: from,
                    });
                }

                // Already delegated account: execute via delegated code at wallet address.
                const tx: TransactionRequest = {
                    ...buildExecuteBatchTx({
                        calls: payload.calls,
                        from,
                        executeAddress: from,
                    }),
                    ...getGasData(gasInfo),
                    gasLimit: gasLimitNum,
                };

                logger.log('🏄🏽‍♂️ Execute Batch Tx', tx);

                const response = await existingWallet.sendTransaction(tx);
                receipt = await response.wait();

                const receipts: CallBatchStatus['receipts'] = receipt
                    ? [this.#mapCallBatchReceipt(receipt)]
                    : [];

                await setCallBatchStatus(batchId, {
                    version: payload.version,
                    chainId: chainIdStr,
                    id: batchId,
                    status: CallBatchStatusCode.Confirmed,
                    atomic: true,
                    receipts,
                });

                return batchId;
            }

            const receipts: CallBatchStatus['receipts'] = [];
            for (const call of payload.calls) {
                const rawValue = call.value;
                const valueField =
                    rawValue === undefined || rawValue === null
                        ? '0x0'
                        : typeof rawValue === 'string'
                          ? rawValue
                          : toHex(rawValue);

                const txForEstimate: TransactionRequest = {
                    from,
                    to: call.to ?? ZeroAddress,
                    data: call.data ?? '0x',
                    value: valueField === '0x' ? '0x0' : valueField,
                };
                const perTxGasLimitStr = await estimateGasWithPadding(
                    txForEstimate,
                    null,
                    null,
                    provider,
                );
                const perTxGasLimit = perTxGasLimitStr
                    ? Math.max(21000, Math.ceil(Number(perTxGasLimitStr)))
                    : 21000;

                const tx: TransactionRequest = {
                    ...txForEstimate,
                    ...getGasData(gasInfo),
                    gasLimit: perTxGasLimit,
                };

                const response = await existingWallet.sendTransaction(tx);
                const receipt = await response.wait();

                if (!receipt) {
                    await setCallBatchStatus(batchId, {
                        version: payload.version,
                        chainId: chainIdStr,
                        id: batchId,
                        status:
                            receipts.length > 0
                                ? CallBatchStatusCode.PartialRevert
                                : CallBatchStatusCode.Reverted,
                        atomic: false,
                        receipts,
                    });
                    throw new Error('Missing receipt');
                }

                receipts.push(this.#mapCallBatchReceipt(receipt));

                if (receipt.status !== 1) {
                    await setCallBatchStatus(batchId, {
                        version: payload.version,
                        chainId: chainIdStr,
                        id: batchId,
                        status:
                            receipts.length > 1
                                ? CallBatchStatusCode.PartialRevert
                                : CallBatchStatusCode.Reverted,
                        atomic: false,
                        receipts,
                    });
                    throw new Error('Call reverted on-chain');
                }
            }

            await setCallBatchStatus(batchId, {
                version: payload.version,
                chainId: chainIdStr,
                id: batchId,
                status: CallBatchStatusCode.Confirmed,
                atomic: false,
                receipts,
            });

            return batchId;
        } catch (error) {
            const current = await getCallBatchStatus(batchId);
            if (!current || current.status === CallBatchStatusCode.Pending) {
                await setCallBatchStatus(batchId, {
                    version: payload.version,
                    chainId: chainIdStr,
                    id: batchId,
                    status: CallBatchStatusCode.Reverted,
                    atomic: pendingAtomic,
                    receipts: current?.receipts,
                });
            }
            throw error;
        }
    }

    async getWalletSendCallsStatus(batchId: string) {
        return await getCallBatchStatus(batchId);
    }

    async hasWalletSendCallsBatch(batchId: string) {
        const status = await getCallBatchStatus(batchId);
        return !!status;
    }

    async getTokenBalance(
        walletAddress: string,
        tokenAddress: string | undefined,
        nativeCoin: boolean,
        chainId: number,
    ) {
        try {
            return await RateLimiters.tokenBalance.execute(async () => {
                return await this.#handleTokenBalance(
                    walletAddress,
                    tokenAddress,
                    nativeCoin,
                    chainId,
                );
            });
        } catch {
            return { balance: BigInt(0), decimals: 18, error: true };
        }
    }

    async getNativeTokenBalance(walletAddress: string, chainId: number) {
        const { balance: _balance } = await this.getTokenBalance(
            walletAddress,
            undefined,
            true,
            chainId,
        );

        const result = _balance.toString();
        logger.log('💰 Load native coin balance', walletAddress, _balance);

        this.update(state => {
            state.nativeTokenBalance = {
                ...state.nativeTokenBalance,
                [walletAddress]: {
                    ...state.nativeTokenBalance[walletAddress],
                    [chainId]: result,
                },
            };
        });
        return result;
    }

    async newSendTransaction(
        accountAddress: string,
        { transaction }: TransactionRequestParam,
        isAAWallet: boolean = false,
    ) {
        logger.log('About to send transaction', transaction);

        const from = (transaction.from ?? accountAddress) as string;

        // Ledger / Trezor hardware (offscreen keyring)
        if (await this.#isHardwareAccount(from)) {
            return await this.#sendTransactionWithHardwareOffscreenKeyring(from, transaction);
        }

        // Regular wallet (HD or simple)
        const wallet = await this.#loadWallet(accountAddress, this.#getCurrentProvider());

        if (!wallet) {
            throw new Error(ErrorMessages.CAN_NOT_LOAD_WALLET);
        }

        return await retryFunc(async () => {
            return await wallet.sendTransaction(transaction);
        });
    }

    async getTransaction(txHash: string, chain_id: number | null = null) {
        if (!txHash) throw new Error('Transaction not found');

        const provider = chain_id
            ? this.#getProviderByChainId(chain_id)
            : this.#getCurrentProvider();

        return await this.#getTransactionByHash(txHash, provider);
    }

    async sendTransaction(
        accountAddress: string,
        receipient: string,
        gasInfo: GasInfo,
        gasLimit: number,
        amount: string,
        asset: Asset,
        isAAWallet: boolean = false,
    ) {
        let senderAddress: string | undefined = accountAddress;

        if (isAAWallet) {
            senderAddress = this.#getAccountByAddress(accountAddress)?.smartAddress;

            if (!senderAddress) {
                throw new Error('Smart account not found');
            }
        }

        const txDetails: NewTransaction = {
            from: senderAddress,
            to: receipient,
            amount,
            gasLimit,
            asset,
            ...getGasData(gasInfo),
        };
        const signableTransaction = await createSignableTransaction(txDetails);

        return await this.newSendTransaction(
            accountAddress,
            {
                transaction: signableTransaction,
            },
            isAAWallet,
        );
    }

    /**
     * Checks if an address is a contract by examining its code
     * @param accountAddress - The address to check
     * @returns Promise<boolean> - True if the address is a contract, false otherwise
     */
    async checkContract(accountAddress: string): Promise<boolean> {
        try {
            const code = await this.#getCurrentProvider().getCode(accountAddress);
            logger.log('🏄🏽‍♂️ Code', code);
            return code !== '0x';
        } catch (error) {
            logger.error('🏄🏽‍♂️ Error checking contract:', error);
            return false;
        }
    }

    async speedUpTransaction(
        accountAddress: string,
        pendingTransaction: TransactionResponse,
        gasInfo: GasInfo,
        isAAWallet: boolean = false,
    ) {
        const fasterTxPayload = {
            data: pendingTransaction.data,
            gasLimit: pendingTransaction.gasLimit,
            nonce: pendingTransaction.nonce,
            to: pendingTransaction.to,
            value: pendingTransaction.value,
            ...getGasData(gasInfo),
        };

        return await this.newSendTransaction(
            accountAddress,
            {
                transaction: fasterTxPayload,
            },
            isAAWallet,
        );
    }

    async cancelTransaction(
        accountAddress: string,
        pendingTransaction: TransactionResponse,
        gasInfo: GasInfo,
    ) {
        const cancelTxPayload = {
            nonce: pendingTransaction.nonce,
            to: accountAddress,
            ...getGasData(gasInfo),
        };

        return await this.newSendTransaction(accountAddress, {
            transaction: cancelTxPayload,
        });
    }

    async ensToWalletAdress(ensName: string) {
        const _provider = this.#getCurrentProvider();
        const walletAddress = await _provider.resolveName(ensName);
        return walletAddress ? walletAddress.toLowerCase() : '';
    }

    /**
     * Add a new unapproved transaction to state. Parameters will be validated, a
     * unique transaction id will be generated, and gas and gasPrice will be calculated
     * if not provided. If A `<tx.id>:unapproved` hub event will be emitted once added.
     *
     * @param txParams - Standard parameters for an Ethereum transaction.
     * @param opts - Additional options to control how the transaction is added.
     * @param opts.actionId - Unique ID to prevent duplicate requests.
     * @param opts.method - RPC method that requested the transaction.
     * @param opts.origin - The origin of the transaction request, such as a dApp hostname.
     * @param opts.requireApproval - Whether the transaction requires approval by the user, defaults to true unless explicitly disabled.
     * @param opts.type - Type of transaction to add, such as 'cancel' or 'swap'.
     * @param opts.chainId - The chain id of the network for this transaction.
     * @returns Object containing a promise resolving to the transaction hash if approved.
     */
    async addTransaction(
        txParams: TransactionParams,
        {
            actionId,
            method,
            origin,
            requireApproval,
            type,
            chainId: requestChainId,
        }: {
            actionId?: string;
            method?: string;
            origin?: string;
            requireApproval?: boolean | undefined;
            type?: TransactionType;
            chainId?: number;
        } = {},
    ): Promise<Result> {
        logger.log('Adding transaction', txParams);

        txParams = normalizeTransactionParams(txParams);
        if (
            requestChainId &&
            getCurrentChains().every(_chain => _chain.chain_id !== requestChainId)
        ) {
            throw new Error('The chainId for this transaction could not be found');
        }

        const selectedNetwork = this.#getSelectedNetwork();
        const chainId = requestChainId ?? selectedNetwork.chain_id;

        validateTxParams(txParams);

        if (origin) {
            const selectedAddresses = this.#getSelectedAccount().smartAddress
                ? [
                      this.#getSelectedAccount().address,
                      this.#getSelectedAccount().smartAddress as string,
                  ]
                : [this.#getSelectedAccount().address];
            await validateTransactionOrigin(
                await this.#getPermittedAccounts(origin),
                selectedAddresses,
                txParams.from,
                origin,
            );
        }

        const dappSuggestedGasFees = this.generateDappSuggestedGasFees(txParams, origin);
        const provider = this.#getProviderByChainId(chainId);
        const transactionType = type ?? (await determineTransactionType(txParams, provider)).type;
        const existingTransactionMeta = this.getTransactionWithActionId(actionId);

        let addedTransactionMeta = existingTransactionMeta
            ? cloneDeep(existingTransactionMeta)
            : {
                  actionId,
                  chainId: toHex(chainId) as `0x${string}`,
                  dappSuggestedGasFees,
                  id: random(),
                  origin,
                  time: Date.now(),
                  txParams,
                  verifiedOnBlockchain: false,
                  type: transactionType,
                  status: TransactionStatus.unapproved as const,
              };

        if (!existingTransactionMeta) {
            this.addMetadata(addedTransactionMeta);

            this.messagingSystem.publish(
                `${controllerName}:unapprovedTransactionAdded`,
                addedTransactionMeta,
            );
        }

        return {
            result: this.processApproval(addedTransactionMeta, {
                isExisting: Boolean(existingTransactionMeta),
                requireApproval,
                actionId,
            }),
            transactionMeta: addedTransactionMeta,
        };
    }

    private addMetadata(transactionMeta: TransactionMeta) {
        this.update(state => {
            state.rpcTransactions = this.trimTransactionsForState([
                ...state.rpcTransactions,
                transactionMeta,
            ]);
        });
    }

    /**
     * Trim the amount of transactions that are set on the state. Checks
     * if the length of the tx history is longer then desired persistence
     * limit and then if it is removes the oldest confirmed or rejected tx.
     * Pending or unapproved transactions will not be removed by this
     * operation. For safety of presenting a fully functional transaction UI
     * representation, this function will not break apart transactions with the
     * same nonce, created on the same day, per network. Not accounting for
     * transactions of the same nonce, same day and network combo can result in
     * confusing or broken experiences in the UI.
     *
     * @param transactions - The transactions to be applied to the state.
     * @returns The trimmed list of transactions.
     */
    private trimTransactionsForState(transactions: TransactionMeta[]): TransactionMeta[] {
        const nonceNetworkSet = new Set();

        const txsToKeep = [...transactions]
            .sort((a, b) => (a.time > b.time ? -1 : 1)) // Descending time order
            .filter(tx => {
                const { chainId, status, txParams, time } = tx;

                if (txParams) {
                    const key = `${String(txParams.nonce)}-${convertHexToDecimal(
                        chainId,
                    )}-${new Date(time).toDateString()}`;

                    if (nonceNetworkSet.has(key)) {
                        return true;
                    } else if (!this.isFinalState(status)) {
                        nonceNetworkSet.add(key);
                        return true;
                    }
                }

                return false;
            });

        txsToKeep.reverse(); // Ascending time order
        return txsToKeep;
    }

    /**
     * Determines if the transaction is in a final state.
     *
     * @param status - The transaction status.
     * @returns Whether the transaction is in a final state.
     */
    private isFinalState(status: TransactionStatus): boolean {
        return (
            status === TransactionStatus.rejected ||
            status === TransactionStatus.confirmed ||
            status === TransactionStatus.failed
        );
    }

    /**
     * Whether the transaction has at least completed all local processing.
     *
     * @param status - The transaction status.
     * @returns Whether the transaction is in a final state.
     */
    private isLocalFinalState(status: TransactionStatus): boolean {
        return [
            TransactionStatus.confirmed,
            TransactionStatus.failed,
            TransactionStatus.rejected,
            TransactionStatus.submitted,
        ].includes(status);
    }

    /**
     * Get transaction with provided actionId.
     *
     * @param actionId - Unique ID to prevent duplicate requests
     * @returns the filtered transaction
     */
    private getTransactionWithActionId(actionId?: string) {
        return this.state.rpcTransactions.find(
            transaction => actionId && transaction.actionId === actionId,
        );
    }

    private generateDappSuggestedGasFees(
        txParams: TransactionParams,
        origin?: string,
    ): DappSuggestedGasFees | undefined {
        if (!origin || origin === ORIGIN_CHILLY) {
            return undefined;
        }

        const { gasPrice, maxFeePerGas, maxPriorityFeePerGas, gas } = txParams;

        if (
            gasPrice === undefined &&
            maxFeePerGas === undefined &&
            maxPriorityFeePerGas === undefined &&
            gas === undefined
        ) {
            return undefined;
        }

        const dappSuggestedGasFees: DappSuggestedGasFees = {};

        if (gasPrice !== undefined) {
            dappSuggestedGasFees.gasPrice = gasPrice;
        } else if (maxFeePerGas !== undefined || maxPriorityFeePerGas !== undefined) {
            dappSuggestedGasFees.maxFeePerGas = maxFeePerGas;
            dappSuggestedGasFees.maxPriorityFeePerGas = maxPriorityFeePerGas;
        }

        if (gas !== undefined) {
            dappSuggestedGasFees.gas = gas;
        }

        return dappSuggestedGasFees;
    }

    private async processApproval(
        transactionMeta: TransactionMeta,
        {
            isExisting = false,
            requireApproval,
            shouldShowRequest = true,
            actionId,
        }: {
            isExisting?: boolean;
            requireApproval?: boolean | undefined;
            shouldShowRequest?: boolean;
            actionId?: string;
        },
    ): Promise<string> {
        const transactionId = transactionMeta.id;
        let resultCallbacks: AcceptResultCallbacks | undefined;
        const { meta, isCompleted } = this.isTransactionCompleted(transactionId);
        const finishedPromise = isCompleted
            ? Promise.resolve(meta)
            : this.waitForTransactionFinished(transactionId);

        if (meta && !isExisting && !isCompleted) {
            try {
                if (requireApproval !== false) {
                    const acceptResult = await this.requestApproval(transactionMeta, {
                        shouldShowRequest,
                    });
                    resultCallbacks = acceptResult.resultCallbacks;

                    const approvalValue = acceptResult.value as
                        | {
                              txMeta?: TransactionMeta;
                          }
                        | undefined;

                    const updatedTransaction = approvalValue?.txMeta;

                    if (updatedTransaction) {
                        logger.log('Updating transaction with approval data', {
                            customNonce: updatedTransaction.customNonceValue,
                            params: updatedTransaction.txParams,
                        });

                        this.updateTransaction(updatedTransaction);
                    }
                }

                const { isCompleted: isTxCompleted } = this.isTransactionCompleted(transactionId);

                if (!isTxCompleted) {
                    await this.approveTransaction(transactionId);

                    const updatedTransactionMeta = this.getTransactionMeta(
                        transactionId,
                    ) as TransactionMeta;
                    this.messagingSystem.publish(`${controllerName}:transactionApproved`, {
                        transactionMeta: updatedTransactionMeta,
                        actionId,
                    });
                }
            } catch (error: any) {
                const { isCompleted: isTxCompleted } = this.isTransactionCompleted(transactionId);

                if (!isTxCompleted) {
                    if (error?.code === errorCodes.provider.userRejectedRequest) {
                        this.cancelRpcTransaction(transactionId, actionId);

                        throw providerErrors.userRejectedRequest(
                            'Chilly Tx Signature: User denied transaction signature.',
                        );
                    } else {
                        this.failTransaction(meta, error, actionId);
                    }
                }
            }
        }

        const finalMeta = await finishedPromise;

        switch (finalMeta?.status) {
            case TransactionStatus.failed:
                resultCallbacks?.error(finalMeta.error);
                throw rpcErrors.internal(finalMeta.error.message);

            case TransactionStatus.submitted:
                resultCallbacks?.success();
                return finalMeta.hash as string;

            default:
                const internalError = rpcErrors.internal(
                    `Chilly Tx Signature: Unknown problem: ${JSON.stringify(
                        finalMeta || transactionId,
                    )}`,
                );

                resultCallbacks?.error(internalError);
                throw internalError;
        }
    }

    /**
     * Cancels a transaction based on its ID by setting its status to "rejected"
     * and emitting a `<tx.id>:finished` hub event.
     *
     * @param transactionId - The ID of the transaction to cancel.
     * @param actionId - The actionId passed from UI
     */
    private cancelRpcTransaction(transactionId: string, actionId?: string) {
        const transactionMeta = this.state.rpcTransactions.find(({ id }) => id === transactionId);

        if (!transactionMeta) {
            return;
        }

        this.update(state => {
            const transactions = state.rpcTransactions.filter(({ id }) => id !== transactionId);
            state.rpcTransactions = this.trimTransactionsForState(transactions);
        });
        const updatedTransactionMeta = {
            ...transactionMeta,
            status: TransactionStatus.rejected as const,
        };
        this.messagingSystem.publish(
            `${controllerName}:transactionFinished`,
            updatedTransactionMeta,
        );
        this.#internalEvents.emit(`${transactionMeta.id}:finished`, updatedTransactionMeta);
        this.messagingSystem.publish(`${controllerName}:transactionRejected`, {
            transactionMeta: updatedTransactionMeta,
            actionId,
        });
        this.onTransactionStatusChange(updatedTransactionMeta);
    }

    /**
     * Stop the signing process for a specific transaction.
     * Throws an error causing the transaction status to be set to failed.
     * @param transactionId - The ID of the transaction to stop signing.
     */
    abortTransactionSigning(transactionId: string) {
        const transactionMeta = this.getTransactionMeta(transactionId);

        if (!transactionMeta) {
            throw new Error(`Cannot abort signing as no transaction metadata found`);
        }

        const abortCallback = this.signAbortCallbacks.get(transactionId);

        if (!abortCallback) {
            throw new Error(`Cannot abort signing as transaction is not waiting for signing`);
        }

        abortCallback();

        this.signAbortCallbacks.delete(transactionId);
    }

    /**
     * Approves a transaction and updates it's status in state. If this is not a
     * retry transaction, a nonce will be generated. The transaction is signed
     * using the sign configuration property, then published to the blockchain.
     * A `<tx.id>:finished` hub event is fired after success or failure.
     *
     * @param transactionId - The ID of the transaction to approve.
     */
    private async approveTransaction(transactionId: string) {
        const cleanupTasks = new Array<() => void>();
        cleanupTasks.push(await this.mutex.acquire());

        let transactionMeta = this.getTransactionOrThrow(transactionId);

        try {
            if (!transactionMeta.chainId) {
                this.failTransaction(transactionMeta, new Error('No chainId defined.'));
                return ApprovalState.NotApproved;
            }

            if (this.approvingTransactionIds.has(transactionId)) {
                logger.log('Skipping approval as signing in progress', transactionId);
                return ApprovalState.NotApproved;
            }

            this.approvingTransactionIds.add(transactionId);
            cleanupTasks.push(() => this.approvingTransactionIds.delete(transactionId));

            const nonce = await this.getNextNonce(transactionMeta);

            transactionMeta = this.#updateTransactionInternal(
                {
                    transactionId,
                },
                draftTxMeta => {
                    const { txParams, chainId } = draftTxMeta;

                    draftTxMeta.status = TransactionStatus.approved;
                    draftTxMeta.txParams = {
                        ...txParams,
                        nonce,
                        chainId,
                        gasLimit: txParams.gas,
                    };
                },
            );

            this.onTransactionStatusChange(transactionMeta);

            let hash = '';

            {
                const rawTx = await this.signTransaction(transactionMeta, transactionMeta.txParams);

                if (!rawTx) {
                    return ApprovalState.NotApproved;
                }

                hash = await this.publishTransaction(transactionMeta, rawTx);
            }

            logger.log('Publish successful', hash);

            transactionMeta = this.#updateTransactionInternal(
                {
                    transactionId,
                },
                draftTxMeta => {
                    draftTxMeta.hash = hash;
                    draftTxMeta.status = TransactionStatus.submitted;
                    draftTxMeta.submittedTime = new Date().getTime();
                },
            );

            this.messagingSystem.publish(`${controllerName}:transactionSubmitted`, {
                transactionMeta,
            });

            this.messagingSystem.publish(`${controllerName}:transactionFinished`, transactionMeta);
            this.#internalEvents.emit(`${transactionId}:finished`, transactionMeta);

            this.onTransactionStatusChange(transactionMeta);
            return ApprovalState.Approved;
        } catch (error: any) {
            this.failTransaction(transactionMeta, error);
            return ApprovalState.NotApproved;
        } finally {
            cleanupTasks.forEach(task => task());
        }
    }

    private async signTransaction(
        transactionMeta: TransactionMeta,
        txParams: TransactionParams,
    ): Promise<string | undefined> {
        logger.log('Signing transaction', txParams);

        const unsignedEthTx = this.prepareUnsignedEthTx(transactionMeta.chainId, txParams);
        this.approvingTransactionIds.add(transactionMeta.id);
        const signedTx = await new Promise<TypedTransaction>((resolve, reject) => {
            // TODO: need to implement our own sign func
            this.sign?.(unsignedEthTx, txParams.from).then(resolve, reject);

            this.signAbortCallbacks.set(transactionMeta.id, () =>
                reject(new Error('Signing aborted by user')),
            );
        });
        this.signAbortCallbacks.delete(transactionMeta.id);

        if (!signedTx) {
            logger.log('Skipping signed status as no signed transaction');
            return undefined;
        }

        const transactionMetaFromHook = cloneDeep(transactionMeta);
        const transactionMetaWithRsv = {
            ...this.updateTransactionMetaRSV(transactionMetaFromHook, signedTx),
            status: TransactionStatus.signed as const,
        };
        this.updateTransaction(transactionMetaWithRsv);
        this.onTransactionStatusChange(transactionMetaWithRsv);
        const rawTx = bufferToHex(signedTx.serialize());
        const transactionMetaWithRawTx = merge({}, transactionMetaWithRsv, {
            rawTx,
        });
        this.updateTransaction(transactionMetaWithRawTx);

        return rawTx;
    }

    private async publishTransaction(
        transactionMeta: TransactionMeta,
        rawTransaction: string,
    ): Promise<string> {
        try {
            const { chainId } = transactionMeta;
            const provider = this.#getProviderByChainId(hexToNumber(chainId));
            const { hash } = await provider.broadcastTransaction(rawTransaction);
            return hash;
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            throw new Error(errorMessage);
        }
    }

    /**
     * Updates the r, s, and v properties of a TransactionMeta object
     * with values from a signed transaction.
     *
     * @param transactionMeta - The TransactionMeta object to update.
     * @param signedTx - The encompassing type for all transaction types containing r, s, and v values.
     * @returns The updated TransactionMeta object.
     */
    private updateTransactionMetaRSV(
        transactionMeta: TransactionMeta,
        signedTx: TypedTransaction,
    ): TransactionMeta {
        const transactionMetaWithRsv = cloneDeep(transactionMeta);

        for (const key of ['r', 's', 'v'] as const) {
            const value = signedTx[key];

            if (value === undefined || value === null) {
                continue;
            }

            transactionMetaWithRsv[key] = add0x(value.toString(16));
        }

        return transactionMetaWithRsv;
    }

    private prepareUnsignedEthTx(chainId: Hex, txParams: TransactionParams): TypedTransaction {
        return TransactionFactory.fromTxData(txParams, {
            freeze: false,
            common: this.getCommonConfiguration(chainId),
        });
    }

    /**
     * `@ethereumjs/tx` uses `@ethereumjs/common` as a configuration tool for
     * specifying which chain, network, hardfork and EIPs to support for
     * a transaction. By referencing this configuration, and analyzing the fields
     * specified in txParams, @ethereumjs/tx is able to determine which EIP-2718
     * transaction type to use.
     *
     * @param chainId - The chainId to use for the configuration.
     * @returns common configuration object
     */
    private getCommonConfiguration(chainId: Hex): Common {
        const customChainParams: Partial<ChainConfig> = {
            chainId: parseInt(chainId, 16),
            defaultHardfork: HARDFORK,
        };

        return Common.custom(customChainParams);
    }

    private async getNextNonce(transactionMeta: TransactionMeta) {
        const {
            chainId,
            customNonceValue,
            txParams: { from, nonce: existingNonce },
        } = transactionMeta;

        if (!chainId) {
            throw new Error('');
        }

        const customNonce = customNonceValue ? toHex(customNonceValue) : undefined;

        if (customNonce) {
            logger.log('Using custom nonce', customNonce);
            return customNonce;
        }

        if (existingNonce) {
            logger.log('Using existing nonce', existingNonce);
            return existingNonce;
        }

        const provider = this.#getProviderByChainId(hexToNumber(chainId));
        const blockNumber = await provider.getBlockNumber();
        const baseCount = await provider.getTransactionCount(from, blockNumber);
        return toHex(baseCount);
    }

    private failTransaction(transactionMeta: TransactionMeta, error: Error, actionId?: string) {
        const newTransactionMeta = merge({}, transactionMeta, {
            error: normalizeTxError(error),
            status: TransactionStatus.failed as const,
        });
        this.messagingSystem.publish(`${controllerName}:transactionFailed`, {
            actionId,
            error: error.message,
            transactionMeta: newTransactionMeta,
        });
        this.updateTransaction(newTransactionMeta);
        this.onTransactionStatusChange(newTransactionMeta);
        this.messagingSystem.publish(`${controllerName}:transactionFinished`, newTransactionMeta);
        this.#internalEvents.emit(`${transactionMeta.id}:finished`, newTransactionMeta);
    }

    private onTransactionStatusChange(transactionMeta: TransactionMeta) {
        this.messagingSystem.publish(`${controllerName}:transactionStatusUpdated`, {
            transactionMeta,
        });
    }

    private getTransactionOrThrow(
        transactionId: string,
        errorMessagePrefix = 'TransactionController',
    ): Readonly<TransactionMeta> {
        const txMeta = this.getTransactionMeta(transactionId);
        if (!txMeta) {
            throw new Error(`${errorMessagePrefix}: No transaction found with id ${transactionId}`);
        }
        return txMeta;
    }

    private async requestApproval(
        txMeta: TransactionMeta,
        { shouldShowRequest }: { shouldShowRequest: boolean },
    ): Promise<AddResult> {
        const id = this.getApprovalId(txMeta);
        const { origin } = txMeta;
        const type = ApprovalType.Transaction;
        const requestData = { txId: txMeta.id };

        return (await this.messagingSystem.call(
            'ApprovalController:addRequest',
            {
                id,
                origin: origin || ORIGIN_CHILLY,
                type,
                requestData,
                expectsResult: true,
            },
            shouldShowRequest,
        )) as Promise<AddResult>;
    }

    private getApprovalId(txMeta: TransactionMeta) {
        return String(txMeta.id);
    }

    private async waitForTransactionFinished(transactionId: string): Promise<TransactionMeta> {
        return new Promise(resolve => {
            this.#internalEvents.once(`${transactionId}:finished`, txMeta => {
                resolve(txMeta);
            });
        });
    }

    private isTransactionCompleted(transactionId: string): {
        meta?: TransactionMeta;
        isCompleted: boolean;
    } {
        const transaction = this.getTransactionMeta(transactionId);

        if (!transaction) {
            return { meta: undefined, isCompleted: false };
        }

        const isCompleted = this.isLocalFinalState(transaction.status);

        return { meta: transaction, isCompleted };
    }

    private getTransactionMeta(transactionId: string): Readonly<TransactionMeta> | undefined {
        const { rpcTransactions } = this.state;
        return rpcTransactions.find(({ id }) => id === transactionId);
    }

    /**
     * Updates an existing transaction in state.
     *
     * @param transactionMeta - The new transaction to store in state.
     * @param note - A note or update reason to include in the transaction history.
     */
    updateTransaction(transactionMeta: TransactionMeta) {
        const { id: transactionId } = transactionMeta;

        this.#updateTransactionInternal({ transactionId }, () => ({
            ...transactionMeta,
        }));
    }

    #updateTransactionInternal(
        { transactionId }: { transactionId: string },
        callback: (transactionMeta: TransactionMeta) => TransactionMeta | void,
    ) {
        this.update(state => {
            const index = state.rpcTransactions.findIndex(({ id }) => id === transactionId);

            let transactionMeta = state.rpcTransactions[index];
            transactionMeta = callback(transactionMeta) ?? transactionMeta;
            transactionMeta.txParams = normalizeTransactionParams(transactionMeta.txParams);

            validateTxParams(transactionMeta.txParams);

            state.rpcTransactions[index] = transactionMeta;
        });

        return this.getTransactionMeta(transactionId) as TransactionMeta;
    }

    #getERC20Contract(address: string, provider?: JsonRpcProvider) {
        return new Contract(address, erc20ABI, provider ?? this.#getCurrentProvider());
    }

    #getERC721Contract(address: string) {
        return new Contract(address, erc721ABI, this.#getCurrentProvider());
    }

    async #isHardwareAccount(address: string): Promise<boolean> {
        try {
            const keyring = await this.messagingSystem.call(
                'KeyringController:getKeyringForAccount',
                address,
            );
            const type = (keyring as { type?: unknown } | null)?.type;
            return type === KeyringTypes.ledger || type === KeyringTypes.trezor;
        } catch {
            return false;
        }
    }

    async #transactionRequestToTxParams(
        fromAddress: string,
        transaction: TransactionRequest,
        chainIdHex: Hex,
    ): Promise<TransactionParams> {
        const provider = this.#getCurrentProvider();
        const from = String(transaction.from ?? fromAddress).trim();

        // Use `pending` so the next nonce includes txs already in the mempool (`latest` would repeat nonce 0).
        const nonceHex =
            transaction.nonce === undefined || transaction.nonce === null
                ? toHex(await provider.getTransactionCount(from, 'pending'))
                : toHex(transaction.nonce);

        const gasLimitSource = transaction.gasLimit;

        let dataHex = '0x';
        if (transaction.data !== undefined && transaction.data !== null) {
            dataHex =
                typeof transaction.data === 'string'
                    ? transaction.data
                    : hexlify(transaction.data as Uint8Array);
        }

        const valueHex = transaction.value != null ? toHex(transaction.value) : '0x0';

        const declaresFeeMarket =
            transaction.maxFeePerGas !== undefined &&
            transaction.maxFeePerGas !== null &&
            transaction.maxPriorityFeePerGas !== undefined &&
            transaction.maxPriorityFeePerGas !== null;

        const params: TransactionParams = {
            from,
            nonce: nonceHex,
            value: valueHex,
            data: dataHex,
            gasLimit: gasLimitSource != null ? toHex(gasLimitSource) : undefined,
            gasPrice:
                !declaresFeeMarket &&
                transaction.gasPrice !== undefined &&
                transaction.gasPrice !== null
                    ? toHex(transaction.gasPrice)
                    : undefined,
            maxFeePerGas:
                transaction.maxFeePerGas !== undefined && transaction.maxFeePerGas !== null
                    ? toHex(transaction.maxFeePerGas)
                    : undefined,
            maxPriorityFeePerGas:
                transaction.maxPriorityFeePerGas !== undefined &&
                transaction.maxPriorityFeePerGas !== null
                    ? toHex(transaction.maxPriorityFeePerGas)
                    : undefined,
        };

        if (transaction.to !== undefined && transaction.to !== null) {
            params.to = String(transaction.to);
        }

        if (declaresFeeMarket) {
            params.type = TransactionEnvelopeType.feeMarket;
        } else if (params.gasPrice !== undefined) {
            params.type = TransactionEnvelopeType.legacy;
        }

        params.chainId = chainIdHex;

        return params;
    }

    async #sendTransactionWithHardwareOffscreenKeyring(
        fromAddress: string,
        transaction: TransactionRequest,
    ): Promise<TransactionResponse> {
        try {
            const selected = this.#getSelectedNetwork();
            const chainIdHex = toHex(selected.chain_id) as Hex;

            const txParams = await this.#transactionRequestToTxParams(
                fromAddress,
                transaction,
                chainIdHex,
            );
            validateTxParams(txParams);

            const unsignedEthTx = this.prepareUnsignedEthTx(chainIdHex, txParams);
            const signedTx = (await this.sign(unsignedEthTx, txParams.from)) as TypedTransaction;
            const rawTx = bufferToHex(signedTx.serialize());

            const provider = this.#getCurrentProvider();
            const { hash } = await provider.broadcastTransaction(rawTx);

            return await this.#getTransactionByHash(hash, provider);
        } catch (error: unknown) {
            let message = getTransactionErrorMessage(error);

            if (message === 'Unknown Error') {
                message = normalizeLedgerDeviceErrorMessage(error);
                if (!message.trim() || message === LEDGER_ERR_GENERIC_FALLBACK) {
                    message = 'Could not send this transaction with your hardware wallet.';
                }
            }

            logger.error(
                'Hardware wallet send failed',
                error instanceof Error ? error : new Error(String(error)),
            );

            throw new Error(message, { cause: error });
        }
    }

    async #loadWallet(walletAddress: string, provider: JsonRpcProvider) {
        const privateKey = await this.#getPrivateKey(walletAddress);
        return new Wallet(privateKey, provider);
    }

    #getSelectedAccount() {
        return this.messagingSystem.call('AccountsController:getSelectedAccount');
    }

    #getAccountByAddress(address: string) {
        return this.messagingSystem.call('AccountsController:getAccountByAddress', address);
    }

    /**
     * Registers message handlers for the AccountsController.
     * @private
     */
    #registerMessageHandlers() {
        // No message handlers required.
    }

    #mapCallBatchReceipt(receipt: {
        hash: string;
        blockHash: string | null;
        blockNumber: bigint | number;
        gasUsed: bigint | number;
        status: number | null;
        logs?: ReadonlyArray<Log>;
    }) {
        return {
            transactionHash: receipt.hash,
            blockHash: receipt.blockHash ?? '',
            blockNumber: String(receipt.blockNumber),
            gasUsed: String(receipt.gasUsed),
            status: receipt.status === 1 ? '0x1' : '0x0',
            logs: (receipt.logs ?? []).map((log: Log) => ({
                address: log.address,
                data: log.data,
                topics: (log.topics ?? []) as string[],
            })),
        };
    }

    #getCurrentProvider(): JsonRpcProvider {
        return this.messagingSystem.call('NetworkController:getCurrentProvider');
    }

    async #getTransactionByHash(
        txHash: string,
        provider: JsonRpcProvider,
    ): Promise<TransactionResponse> {
        return await retryFunc(
            async () => {
                const tx = await provider.getTransaction(txHash);

                if (!tx) {
                    throw new Error('Transaction not found');
                }

                return tx;
            },
            { count: 60, delay: 1000 },
        );
    }

    async #getERC20Decimals(tokenAddress: string, contract: Contract, chainId: number) {
        const cachedDecimal = this.state.decimalsData[chainId]?.[tokenAddress];

        if (typeof cachedDecimal !== 'undefined') {
            return cachedDecimal;
        }

        const decimal = await contract.decimals();

        // The 'decimals' value returned from an ERC20 contract can be either a number or a BigInt,
        // depending on the contract implementation. To ensure consistent handling, we convert it to a number.
        const numVal = Number(decimal);

        this.update(state => {
            state.decimalsData = {
                ...state.decimalsData,
                [chainId]: {
                    ...state.decimalsData[chainId],
                    [tokenAddress]: numVal,
                },
            };
        });

        return numVal;
    }

    async #getERC20Balance(
        userAddress: string,
        tokenAddress: string,
        contract: Contract,
        chainId: number,
    ) {
        const cachedBalance = this.state.balanceData[userAddress]?.[chainId]?.[tokenAddress];

        if (cachedBalance) {
            const diff = Date.now() - cachedBalance.timestamp;

            // Return the cache balance if the interval < 10 seconds
            if (diff < BALANCE_CACHE_INTERVAL) {
                return cachedBalance.value;
            }
        }

        const balance = await contract.balanceOf(userAddress);

        this.update(state => {
            state.balanceData = {
                ...state.balanceData,
                [userAddress]: {
                    ...state.balanceData[userAddress],
                    [chainId]: state.balanceData[userAddress]
                        ? {
                              ...state.balanceData[userAddress][chainId],
                              [tokenAddress]: {
                                  value: balance.toString(),
                                  timestamp: Date.now(),
                              },
                          }
                        : {
                              [tokenAddress]: {
                                  value: balance.toString(),
                                  timestamp: Date.now(),
                              },
                          },
                },
            };
        });

        return balance.toString();
    }

    async #getNativeBalance(userAddress: string, chainId: number) {
        const cachedBalance = this.state.balanceData[userAddress]?.[chainId]?.native;

        if (cachedBalance) {
            const diff = Date.now() - cachedBalance.timestamp;

            // Return the cache balance if the interval < 10 seconds
            if (diff < BALANCE_CACHE_INTERVAL) {
                return cachedBalance.value;
            }
        }

        const _provider = this.#getProviderByChainId(chainId);
        const balance = await _provider.getBalance(userAddress);

        this.update(state => {
            state.balanceData = {
                ...state.balanceData,
                [userAddress]: {
                    ...state.balanceData[userAddress],
                    [chainId]: state.balanceData[userAddress]
                        ? {
                              ...state.balanceData[userAddress][chainId],
                              native: {
                                  value: balance.toString(),
                                  timestamp: Date.now(),
                              },
                          }
                        : {
                              native: {
                                  value: balance.toString(),
                                  timestamp: Date.now(),
                              },
                          },
                },
            };
        });

        return balance.toString();
    }

    async #getOnchainTokenBalance(tokenAddress: string, userAddress: string, chainId: number) {
        const provider = this.#getProviderByChainId(chainId);
        const tokenContract = this.#getERC20Contract(tokenAddress, provider);

        return await retryFunc(
            async () => {
                const decimals = await this.#getERC20Decimals(tokenAddress, tokenContract, chainId);
                const balance = await this.#getERC20Balance(
                    userAddress,
                    tokenAddress,
                    tokenContract,
                    chainId,
                );

                return { balance: BigInt(balance), decimals };
            },
            { delay: 1000, count: 0 },
        );
    }

    async #handleTokenBalance(
        walletAddress: string,
        tokenAddress: string | undefined,
        nativeCoin: boolean,
        chainId: number,
    ) {
        if (!nativeCoin && tokenAddress) {
            try {
                const result = await this.#getOnchainTokenBalance(
                    tokenAddress,
                    walletAddress,
                    chainId,
                );

                return {
                    ...result,
                    error: false,
                };
            } catch (error: any) {
                logger.error('getTokenBalance', 'ERC20', tokenAddress, chainId);
                return { balance: BigInt(0), decimals: 18, error: true };
            }
        } else {
            const nativeDecimals = this.#getNativeDecimals(chainId);

            try {
                const result = await retryFunc(
                    async () => {
                        return await this.#getNativeBalance(walletAddress, chainId);
                    },
                    { delay: 1000, count: 0 },
                );

                return { balance: BigInt(result), decimals: nativeDecimals, error: false };
            } catch (error: any) {
                logger.error('getTokenBalance', 'Native', tokenAddress, chainId);
                return { balance: BigInt(0), decimals: nativeDecimals, error: true };
            }
        }
    }

    #getNativeDecimals(chainId?: number): number {
        try {
            const chain = chainId
                ? getCurrentChainByChainId(chainId)
                : this.#getSelectedNetwork();
            return chain?.native_coin_decimals ?? 18;
        } catch {
            return 18;
        }
    }

    /**
     * Converts TransactionParams to TransactionRequest format required by ethers.
     *
     * @param txParams - Transaction parameters to convert
     * @returns TransactionRequest compatible with ethers
     */
    #convertTransactionParamsToRequest(txParams: TransactionParams): TransactionRequest {
        const request: TransactionRequest = {
            from: txParams.from,
        };

        // --- Parsers ---
        const parseBigNumberish = (v?: string): bigint | undefined => {
            if (v == null) return undefined;

            try {
                return BigInt(v); // supports hex or decimal
            } catch {
                throw new Error(`Invalid BigNumberish input: ${v}`);
            }
        };

        const parseNumber = (v?: string): number | undefined => {
            if (v == null) return undefined;

            let n: number;
            try {
                n = Number(BigInt(v));
            } catch {
                throw new Error(`Invalid numeric input: ${v}`);
            }

            if (!Number.isSafeInteger(n)) {
                throw new Error(`Unsafe integer: ${v}`);
            }

            return n;
        };

        // --- Apply fields ---
        if (txParams.to) request.to = txParams.to;
        if (txParams.data) request.data = txParams.data;

        const value = parseBigNumberish(txParams.value);
        if (value !== undefined) request.value = value;

        const gasLimit = parseBigNumberish(txParams.gasLimit) ?? parseBigNumberish(txParams.gas);
        if (gasLimit !== undefined) request.gasLimit = gasLimit;

        const gasPrice = parseBigNumberish(txParams.gasPrice);
        if (gasPrice !== undefined) request.gasPrice = gasPrice;

        const maxFeePerGas = parseBigNumberish(txParams.maxFeePerGas);
        if (maxFeePerGas !== undefined) request.maxFeePerGas = maxFeePerGas;

        const maxPriorityFeePerGas = parseBigNumberish(txParams.maxPriorityFeePerGas);
        if (maxPriorityFeePerGas !== undefined) request.maxPriorityFeePerGas = maxPriorityFeePerGas;

        const nonce = parseNumber(txParams.nonce);
        if (nonce !== undefined) request.nonce = nonce;

        if (txParams.accessList) {
            request.accessList = txParams.accessList;
        }

        const type = parseNumber(txParams.type);
        if (type !== undefined) {
            if (type !== 0 && type !== 1 && type !== 2) {
                throw new Error(`Invalid transaction type: ${type}`);
            }
            request.type = type;
        }

        const chainId = parseBigNumberish(txParams.chainId);
        if (chainId !== undefined) request.chainId = chainId;

        return request;
    }
}
