import { BigNumber } from '@ethersproject/bignumber';
import { SubjectMetadata } from '@metamask/permission-controller';
import { ethErrors, serializeError } from 'eth-rpc-errors';
import { parseEther } from 'ethers';
import {
    createContext,
    MutableRefObject,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useHistory } from 'react-router-dom';
import { AccountCallInput } from '../../../api/graphQL/Types';
import { getGasData, omitFlatten } from '../../../lib/WalletUtils';
import { hexToNumber, toHex } from '../../../lib/web3';
import { ENVIRONMENT_TYPE_NOTIFICATION, UI_DELAY_INTERNAL } from '../../../shared/constants/app';
import {
    DEFAULT_ROUTE,
    PERMISSION_CONFIRMATION_ROUTE,
    SIGNATURE_REQUEST_ROUTE,
    SWITCH_NETWORK_ROUTE,
    TX_CONFIRMATION_CALLS_STATUS_ROUTE,
    TX_CONFIRMATION_CONTRACT_INTERACTION_ROUTE,
    TX_CONFIRMATION_DEPLOY_CONTRACT_ROUTE,
    TX_CONFIRMATION_SEND_CALLS_ROUTE,
    TX_CONFIRMATION_SEND_NATIVE_COIN_ROUTE,
    TX_CONFIRMATION_SEND_OTHER_COIN_ROUTE,
    TX_CONFIRMATION_TOKEN_ALLOWANCE_ROUTE,
} from '../../../shared/constants/routes';
import ErrorMessages from '../../../shared/messages/ErrorMessages';
import EventType from '../../../shared/types/EventType';
import { AssetDetail, TransactionMeta, TransactionType } from '../../../shared/types/Transaction';
import { GasInfo, ChillyAccount, HandledGasData } from '../../../shared/types/Wallet';
import eventManager from '../../../shared/utils/eventManager';
import logger from '../../../shared/utils/logger';
import { isEqualCaseInsensitive } from '../../../shared/utils/string';
import {
    getAssetDetails,
    getNativeAssetDetails,
    getTxValue,
} from '../../../shared/utils/token-utils';
import { getEnvironmentType } from '../../../shared/utils/utils';
import {
    estimateGas,
    getNativeTokenBalance,
    hideLoadingIndicator,
    rejectPendingApproval,
    showLoadingIndicator,
    updateAndApproveTx,
} from '../../../store/actions/uiActions';
import {
    useCurrentAccountByAddress,
    useFirstPermissionRequest,
    useFirstUnapprovedMessage,
    useNativeCoinBalance,
    usePlatform,
    useSelectedNetwork,
    useSubjectMetadataByOrigin,
} from '../../../store/selectors';
import {
    useFirstWalletSendCallsApprovalRequest,
    useFirstWalletShowCallsStatusApprovalRequest,
} from '../../../store/selectors/eip5792';
import { useFirstUnapprovedNetworkRequest } from '../../../store/selectors/network';
import { useFirstUnapprovedTx } from '../../../store/selectors/transactions';
import { useAppDispatch } from '../../../store/store';
import Toast from '../../components/Toast';

type GasData = { gasInfo: GasInfo; gasFee: bigint; gasPrice: bigint };

type DappInteractionContextType = {
    subjectMetadata: SubjectMetadata | null;
    tokenAddress: string;
    origin: string;
    assetDetails?: AssetDetail;
    currentRequest: TransactionMeta | null;
    approvalAmount: string;
    isSmartWallet: boolean;
    walletAddress: string;
    gasLimit: number;
    loadingGasLimit: boolean;
    initGasInfo?: GasInfo;
    setApprovalAmount: (value: string) => void;
    onRejectPress: () => Promise<void>;
    onConfirmPress: (isApprovalTx?: boolean) => Promise<void>;
    waitingRef?: MutableRefObject<boolean | 'ignore'>;
    error: string;
    onGasChange?: (gasData: HandledGasData, gasFee: bigint) => void;
    emoji?: string | null;
    confirmButtonDisabled: boolean;
    accountName: string;
    toAddress: string;
    currentAccount?: ChillyAccount;
    confirmCalls: AccountCallInput[];
};

export const DappInteractionContext = createContext<DappInteractionContextType>({
    subjectMetadata: null,
    tokenAddress: '',
    origin: '',
    currentRequest: null,
    approvalAmount: '',
    isSmartWallet: false,
    walletAddress: '',
    gasLimit: 0,
    loadingGasLimit: false,
    setApprovalAmount: () => {},
    onRejectPress: async () => {},
    onConfirmPress: async () => {},
    onGasChange: async () => {},
    error: '',
    confirmButtonDisabled: true,
    accountName: '',
    toAddress: '',
    confirmCalls: [],
});

export const useDappInteractionData = () => {
    return useContext(DappInteractionContext);
};

export default function DappInteractionProvider(props: any) {
    const dispatch = useAppDispatch();
    const history = useHistory();
    const selectedNetwork = useSelectedNetwork();
    const firstpermissionRequest = useFirstPermissionRequest();
    const firstUnapproveMsg = useFirstUnapprovedMessage();
    const firstUnapproveTx = useFirstUnapprovedTx();
    const firstNetworkRequest = useFirstUnapprovedNetworkRequest();
    const firstSendCallsRequest = useFirstWalletSendCallsApprovalRequest();
    const firstShowCallsStatusRequest = useFirstWalletShowCallsStatusApprovalRequest();
    const platform = usePlatform();

    const waitingRef = useRef<boolean | 'ignore'>(false);

    const [assetDetails, setAssetDetails] = useState<AssetDetail | undefined>();
    const [approvalAmount, setApprovalAmount] = useState<string>('');
    const [gasLimit, setGasLimit] = useState<number>(0);
    const [loadingGasLimit, setLoadingGasLimit] = useState(false);
    const [localError, setLocalError] = useState('');
    const [remoteError, setRemoteError] = useState('');
    const [currentRequest, setCurrentRequest] = useState(firstUnapproveTx);
    const [handling, setHandling] = useState(false);
    const [initGasInfo, setInitGasInfo] = useState<GasInfo | undefined>();
    const [gasData, setGasData] = useState<GasData | undefined>();

    const walletAddress = useMemo(() => {
        return currentRequest?.txParams?.from ?? '';
    }, [currentRequest]);

    const { account: currentAccount, isSmartWallet } = useCurrentAccountByAddress(walletAddress);

    const toAddress = useMemo(() => {
        const { to: txParamsToAddress } = (currentRequest && currentRequest.txParams) || {};
        return txParamsToAddress ?? '';
    }, [currentRequest]);

    const error = useMemo(() => {
        return localError === 'loading'
            ? ''
            : localError
              ? localError
              : remoteError
                ? remoteError
                : '';
    }, [localError, remoteError]);

    const emoji = useMemo(() => {
        return isSmartWallet
            ? currentAccount?.metadata.avatar
            : currentAccount?.metadata.smartAvatar;
    }, [currentAccount, isSmartWallet]);

    const accountName = useMemo(() => {
        return currentAccount?.metadata.name ?? 'Unknown';
    }, [currentAccount]);

    const confirmButtonDisabled = useMemo(() => {
        return !!error;
    }, [error]);

    const nativeTokenBalance = useNativeCoinBalance(walletAddress);

    const origin = useMemo(() => {
        return currentRequest?.origin ?? '';
    }, [currentRequest?.origin]);

    const subjectMetadata = useSubjectMetadataByOrigin(origin);

    const tokenAddress = useMemo(() => {
        return currentRequest?.txParams.to ?? '';
    }, [currentRequest?.txParams.to]);

    const isNativeCoin = useMemo(() => {
        return isEqualCaseInsensitive(tokenAddress, selectedNetwork.native_coin_address);
    }, [selectedNetwork.native_coin_address, tokenAddress]);

    const onRejectPress = useCallback(async () => {
        if (!currentRequest || waitingRef.current) {
            return;
        }

        setHandling(true);

        try {
            await dispatch(
                rejectPendingApproval(
                    currentRequest.id,
                    serializeError(ethErrors.provider.userRejectedRequest()),
                ),
            );
            Toast.showSuccess('Reject request succeeded');
            waitingRef.current = 'ignore';
        } catch (error: any) {
            const message = error?.message;

            if (message) {
                Toast.showError(message);
            }
        }

        setHandling(false);
    }, [dispatch, currentRequest]);

    const onConfirmPress = useCallback(
        async (isApprovalTx?: boolean) => {
            if (!currentRequest || waitingRef.current || !gasData?.gasInfo) {
                return;
            }

            let _gasLimit = gasLimit;

            setHandling(true);

            const dappProposedTokenAmount = assetDetails?.tokenAmount?.toString(10);
            const { type, ...rest } = getGasData(gasData.gasInfo);

            const cleanTxParams = omitFlatten(currentRequest.txParams, [
                'gasPrice',
                'maxFeePerGas',
                'maxPriorityFeePerGas',
            ]);

            const fullTxData = {
                ...currentRequest,
                txParams: { ...cleanTxParams, ...rest, type: String(type) },
            };

            if (!fullTxData.txParams.gas || !fullTxData.txParams.gasLimit) {
                fullTxData.txParams.gas = toHex(_gasLimit);
                fullTxData.txParams.gasLimit = toHex(_gasLimit);
            }

            if (dappProposedTokenAmount) {
                fullTxData.dappProposedTokenAmount = dappProposedTokenAmount;
                fullTxData.originalApprovalAmount = dappProposedTokenAmount;
            }

            if (isApprovalTx) {
                if (approvalAmount) {
                    fullTxData.customTokenAmount = approvalAmount;
                    fullTxData.finalApprovalAmount = approvalAmount;
                } else if (dappProposedTokenAmount !== undefined) {
                    fullTxData.finalApprovalAmount = dappProposedTokenAmount;
                }
            }

            if (assetDetails?.balance) {
                fullTxData.currentTokenBalance = assetDetails.balance;
            }

            try {
                await dispatch(updateAndApproveTx(fullTxData));
                Toast.showSuccess(
                    isApprovalTx ? 'Approve request succeeded' : 'Confirm Tx succeeded',
                );
            } catch (error: any) {
                const message = error?.message;

                if (message) {
                    Toast.showError(message);
                }
            }

            setHandling(false);
        },
        [
            assetDetails,
            currentRequest,
            dispatch,
            gasLimit,
            gasData,
            approvalAmount,
            walletAddress,
            selectedNetwork.chain_id,
        ],
    );

    const onGasChange = useCallback((gasData: HandledGasData, gasFee: bigint) => {
        setGasData({ ...gasData, gasFee });
    }, []);

    // Transaction params as AccountCallInput, used for fee estimation.
    const confirmCalls = useMemo((): AccountCallInput[] => {
        if (!currentRequest?.txParams) {
            return [];
        }

        const { to, data, value } = currentRequest.txParams;

        // Create the main transaction call
        const calls: AccountCallInput[] = [
            {
                to: to || '',
                data: data || '0x',
                value: value || '0',
            },
        ];

        logger.log('🏄🏽‍♂️ DApp confirm calls', calls);
        return calls;
    }, [currentRequest]);

    useEffect(() => {
        if (!walletAddress || !currentRequest) {
            return;
        }

        if (currentRequest.txParams.data) {
            dispatch(showLoadingIndicator());
            getAssetDetails(tokenAddress, walletAddress, currentRequest?.txParams.data)
                .then(result => {
                    setAssetDetails(result);

                    if (result.tokenAmount) {
                        setApprovalAmount(result.tokenAmount.toString(10));
                    }
                })
                .catch(e => {
                    logger.log(e);
                })
                .finally(() => {
                    dispatch(hideLoadingIndicator());
                });
        } else if (
            currentRequest.type === TransactionType.simpleSend &&
            currentRequest.txParams.to
        ) {
            let value = '0';

            try {
                if (currentRequest.txParams.value) {
                    value = BigNumber.from(currentRequest.txParams.value).toString();
                }
            } catch (e) {
                // do nothing
            }

            dispatch(showLoadingIndicator());
            getNativeAssetDetails(tokenAddress, currentRequest?.txParams.to, value, walletAddress)
                .then(result => {
                    setAssetDetails(result);

                    if (result.tokenAmount) {
                        setApprovalAmount(result.tokenAmount.toString(10));
                    }
                })
                .catch(e => {
                    logger.log(e);
                })
                .finally(() => {
                    dispatch(hideLoadingIndicator());
                });
        }
    }, [
        walletAddress,
        selectedNetwork.native_coin_address,
        tokenAddress,
        dispatch,
        isNativeCoin,
        currentRequest,
    ]);

    useEffect(() => {
        if (!walletAddress || !currentRequest || !gasData?.gasFee || localError) {
            return;
        }

        const amount = getTxValue(currentRequest.txParams);
        const amountBigInt = parseEther(amount);

        if (amountBigInt + gasData.gasFee > nativeTokenBalance) {
            setRemoteError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS);
        } else {
            setRemoteError('');
        }
    }, [currentRequest, gasData, nativeTokenBalance, walletAddress, localError, assetDetails]);

    useEffect(() => {
        if (!currentRequest) {
            setGasData(undefined);
        } else if (walletAddress) {
            dispatch(getNativeTokenBalance(walletAddress));
            setLocalError('loading');
            setRemoteError('');
        }
    }, [currentRequest, dispatch, walletAddress]);

    useEffect(() => {
        if (currentRequest) {
            let amount = getTxValue(currentRequest.txParams);

            if (nativeTokenBalance === 0n || parseFloat(amount) >= nativeTokenBalance) {
                setLocalError(ErrorMessages.INSUFFICIENT_FUNDS_FOR_AMOUNT_AND_GAS);
            } else {
                setLocalError('');
            }
        }
    }, [nativeTokenBalance, currentRequest]);

    useEffect(() => {
        if (!handling) {
            if (firstNetworkRequest !== null) {
                waitingRef.current = false;
                history.replace(SWITCH_NETWORK_ROUTE);
            } else if (firstpermissionRequest) {
                waitingRef.current = false;
                history.replace(PERMISSION_CONFIRMATION_ROUTE);
            } else if (firstUnapproveMsg !== null) {
                waitingRef.current = false;
                history.replace(SIGNATURE_REQUEST_ROUTE);
            } else if (firstSendCallsRequest) {
                waitingRef.current = false;
                history.replace(TX_CONFIRMATION_SEND_CALLS_ROUTE);
            } else if (firstShowCallsStatusRequest) {
                waitingRef.current = false;
                history.replace(TX_CONFIRMATION_CALLS_STATUS_ROUTE);
            } else if (firstUnapproveTx) {
                waitingRef.current = false;
                setCurrentRequest(firstUnapproveTx);

                switch (firstUnapproveTx.type) {
                    case TransactionType.deployContract:
                        history.replace(TX_CONFIRMATION_DEPLOY_CONTRACT_ROUTE);
                        break;

                    case TransactionType.tokenMethodApprove:
                        history.replace(TX_CONFIRMATION_TOKEN_ALLOWANCE_ROUTE);
                        break;

                    case TransactionType.simpleSend:
                        history.replace(TX_CONFIRMATION_SEND_NATIVE_COIN_ROUTE);
                        break;

                    case TransactionType.tokenMethodTransfer:
                        history.replace(TX_CONFIRMATION_SEND_OTHER_COIN_ROUTE);
                        break;

                    default:
                        history.replace(TX_CONFIRMATION_CONTRACT_INTERACTION_ROUTE);
                        break;
                }
            } else {
                if (getEnvironmentType() === ENVIRONMENT_TYPE_NOTIFICATION) {
                    if (waitingRef.current === 'ignore') {
                        waitingRef.current = false;
                        platform.closeCurrentWindow();
                    } else {
                        waitingRef.current = true;
                        setTimeout(() => {
                            if (waitingRef.current) {
                                waitingRef.current = false;
                                platform.closeCurrentWindow();
                            }
                        }, UI_DELAY_INTERNAL);
                    }
                } else {
                    history.replace(DEFAULT_ROUTE);
                }
            }
        }
    }, [
        firstNetworkRequest,
        firstUnapproveMsg,
        firstSendCallsRequest,
        firstShowCallsStatusRequest,
        firstUnapproveTx,
        firstpermissionRequest,
        handling,
        history,
        platform,
    ]);

    useEffect(() => {
        if (localError) {
            return;
        }

        if (currentRequest?.dappSuggestedGasFees?.gas) {
            const _gasLimit = hexToNumber(currentRequest?.dappSuggestedGasFees?.gas);
            setGasLimit(_gasLimit);
        } else if (currentRequest?.txParams) {
            setLoadingGasLimit(true);
            estimateGas(currentRequest.txParams)
                .then(result => {
                    if (result) {
                        setGasLimit(parseInt(result, 10));
                        setRemoteError('');
                    } else {
                        setRemoteError(ErrorMessages.ASSET_ERROR);
                    }
                })
                .catch(e => {
                    setRemoteError(e.message);
                    logger.log('Dapp Interaction', 'Estimate Gas', e);
                })
                .finally(() => {
                    setLoadingGasLimit(false);
                });
        }
    }, [currentRequest, localError]);

    useEffect(() => {
        if (currentRequest?.dappSuggestedGasFees?.gasPrice) {
            const _gasPrice = BigInt(currentRequest.dappSuggestedGasFees.gasPrice);
            setInitGasInfo({ gasPrice: _gasPrice });
        } else if (
            currentRequest?.dappSuggestedGasFees?.maxFeePerGas &&
            currentRequest?.dappSuggestedGasFees?.maxPriorityFeePerGas
        ) {
            const _maxFeePerGas = BigInt(currentRequest.dappSuggestedGasFees.maxFeePerGas);
            const _maxPriorityFeePerGas = BigInt(
                currentRequest.dappSuggestedGasFees.maxPriorityFeePerGas,
            );
            setInitGasInfo({
                priorityFee: _maxPriorityFeePerGas,
                maxFeePerGas: _maxFeePerGas,
                baseFee: _maxFeePerGas - _maxPriorityFeePerGas,
            });
        } else {
            setInitGasInfo(undefined);
        }
    }, [currentRequest]);

    useEffect(() => {
        eventManager.on(EventType.SET_CONFIRMATION_HANDLING, setHandling);

        return () => {
            eventManager.off(EventType.SET_CONFIRMATION_HANDLING, setHandling);
        };
    }, []);

    return (
        <DappInteractionContext.Provider
            value={{
                subjectMetadata,
                tokenAddress,
                origin,
                currentRequest,
                approvalAmount,
                isSmartWallet,
                walletAddress,
                gasLimit,
                loadingGasLimit,
                assetDetails,
                setApprovalAmount,
                onRejectPress,
                onConfirmPress,
                waitingRef,
                initGasInfo,
                error,
                onGasChange,
                emoji,
                confirmButtonDisabled,
                accountName,
                toAddress,
                currentAccount,
                confirmCalls,
            }}>
            {props.children}
        </DappInteractionContext.Provider>
    );
}
