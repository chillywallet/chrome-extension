import { Contract, isAddress, JsonRpcProvider } from 'ethers';
import _ from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { buildCustomTokensPreference } from '../../lib/customTokens';
import erc1155ABI from '../../lib/erc1155-abi.json';
import erc20ABI from '../../lib/erc20-abi.json';
import erc721ABI from '../../lib/erc721-abi.json';
import { readAddressAsContract } from '../../lib/transactions/utils';
import EventType from '../../shared/types/EventType';
import eventManager from '../../shared/utils/eventManager';
import logger from '../../shared/utils/logger';
import { getRpcUrlByNetwork } from '../../shared/utils/rpc';
import {
    hideLoadingIndicator,
    setPreferences,
    showLoadingIndicator,
} from '../../store/actions/uiActions';
import { usePreferences, useSelectedNetwork } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import Header from './Header';
import Modal from './Modal';
import TextInput from './TextInput';
import Toast from './Toast';
import { createRpcProvider } from '../../lib/rpcProvider';

type Props = {
    visible: boolean;
    walletAddress?: string;
    onClosePress: () => void;
};

type TokenInfo = {
    type: 'ERC20' | 'ERC721' | 'ERC1155' | null;
    name: string;
    symbol: string;
    decimals?: number;
};

export default React.memo<Props>((props: Props) => {
    const { visible, walletAddress, onClosePress } = props;
    const dispatch = useAppDispatch();
    const currentChain = useSelectedNetwork();
    const { customNetworks = [], rpcUrls = {} } = usePreferences();
    const [contractAddress, setContractAddress] = useState<string>('');
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState(false);
    const [tokenError, setTokenError] = useState<string | null>(null);

    const provider = useMemo(() => {
        if (!currentChain) {
            return null;
        }

        const rpcUrl = getRpcUrlByNetwork(currentChain, {
            rpcUrls,
            customNetworks,
        });

        if (!rpcUrl) {
            return null;
        }

        return createRpcProvider(rpcUrl, currentChain.chain_id);
    }, [currentChain, rpcUrls, customNetworks]);

    const detectTokenType = useCallback(
        async (address: string): Promise<TokenInfo | null> => {
            if (!currentChain || !isAddress(address) || !provider) {
                return null;
            }

            try {
                const { isContractLikeAddress } = await readAddressAsContract(provider, address);

                if (!isContractLikeAddress) {
                    return null;
                }

                // Try ERC20 first
                try {
                    const erc20Contract = new Contract(address, erc20ABI, provider);
                    const [name, symbol, decimals] = await Promise.all([
                        erc20Contract.name(),
                        erc20Contract.symbol(),
                        erc20Contract.decimals(),
                    ]);

                    return {
                        type: 'ERC20',
                        name: name || '',
                        symbol: symbol || '',
                        decimals: Number(decimals),
                    };
                } catch {
                    // Not ERC20, try ERC721
                }

                // Try ERC721
                try {
                    const erc721Contract = new Contract(address, erc721ABI, provider);
                    const [name, symbol] = await Promise.all([
                        erc721Contract.name(),
                        erc721Contract.symbol(),
                    ]);

                    return {
                        type: 'ERC721',
                        name: name || '',
                        symbol: symbol || '',
                    };
                } catch {
                    // Not ERC721, try ERC1155
                }

                // Try ERC1155 (some ERC1155 contracts have name/symbol, but not all)
                try {
                    const erc1155Contract = new Contract(address, erc1155ABI, provider);
                    // Check if it has balanceOf function (standard ERC1155 function)
                    if (walletAddress) {
                        await erc1155Contract.balanceOf(walletAddress, 0);
                    }

                    // Try to get name and symbol if available
                    let name = 'Unnamed Token';
                    let symbol = '';

                    try {
                        name = await erc1155Contract.name();
                    } catch {
                        // name() not available
                    }

                    try {
                        symbol = await erc1155Contract.symbol();
                    } catch {
                        // symbol() not available
                    }

                    return {
                        type: 'ERC1155',
                        name: name || 'Unnamed Token',
                        symbol: symbol || '',
                    };
                } catch {
                    // Not ERC1155
                }

                return null;
            } catch (error) {
                logger.error('detectTokenType', error);
                return null;
            }
        },
        [currentChain, provider, walletAddress],
    );

    const debouncedDetectToken = useMemo(
        () =>
            _.debounce(async (address: string) => {
                if (!address || address.trim() === '') {
                    setTokenInfo(null);
                    setTokenError(null);
                    setIsLoadingTokenInfo(false);
                    return;
                }

                if (!isAddress(address)) {
                    setTokenInfo(null);
                    setTokenError('Invalid address format');
                    setIsLoadingTokenInfo(false);
                    return;
                }

                setIsLoadingTokenInfo(true);
                setTokenError(null);

                const info = await detectTokenType(address);

                if (info) {
                    setTokenInfo(info);
                    setTokenError(null);
                } else {
                    setTokenInfo(null);
                    setTokenError('Invalid token contract. Must be ERC20, ERC721, or ERC1155.');
                }

                setIsLoadingTokenInfo(false);
            }, 500),
        [detectTokenType],
    );

    useEffect(() => {
        debouncedDetectToken(contractAddress);

        return () => {
            debouncedDetectToken.cancel();
        };
    }, [contractAddress, debouncedDetectToken]);

    const onAddPress = useCallback(() => {
        if (tokenError) {
            Toast.showError(tokenError);
            return;
        }

        if (!tokenInfo) {
            Toast.showError('Please enter a valid token contract address');
            return;
        }

        if (contractAddress && walletAddress && currentChain) {
            dispatch(showLoadingIndicator());
            const customTokens = buildCustomTokensPreference(currentChain.chain_id, {
                address: contractAddress,
                name: tokenInfo.name,
                symbol: tokenInfo.symbol,
                decimals: tokenInfo.decimals ?? 18,
            });
            (dispatch(setPreferences({ customTokens })) as unknown as Promise<void>)
                .then(() => {
                    eventManager.emit(EventType.REFRESH_WALLET);
                    Toast.showSuccess('Add token succeeded.');
                    onClosePress();
                })
                .catch(() => {})
                .finally(() => {
                    dispatch(hideLoadingIndicator());
                });
        }
    }, [
        contractAddress,
        walletAddress,
        currentChain,
        dispatch,
        onClosePress,
        tokenInfo,
        tokenError,
    ]);

    useEffect(() => {
        if (!visible) {
            setContractAddress('');
            setTokenInfo(null);
            setTokenError(null);
            setIsLoadingTokenInfo(false);
        }
    }, [visible]);

    return (
        <Modal
            visible={visible}
            onClose={() => {
                onClosePress();
            }}>
            <Header title="Add Custom Token" hasBackButton={false} onClosePress={onClosePress} />
            <div className="flex flex-col p-3">
                <TextInput
                    label="CONTRACT ADDRESS"
                    className="mb-2"
                    type="text"
                    placeholder="0xabc..."
                    value={contractAddress}
                    onChange={e => setContractAddress(e.target.value)}
                />

                {isLoadingTokenInfo && (
                    <div className="flex flex-row items-center justify-center mb-4">
                        <FaSpinner className="animate-spin text-primary text-xl mr-2" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            Checking token contract...
                        </span>
                    </div>
                )}

                {tokenError && !isLoadingTokenInfo && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                        <div className="text-red-600 dark:text-red-400 text-sm">{tokenError}</div>
                    </div>
                )}

                {tokenInfo && !isLoadingTokenInfo && (
                    <div className="mb-4">
                        <div className="bg-slate-50 dark:bg-dark border border-gray-300 dark:border-neutral-500 rounded-lg p-4">
                            <div className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">
                                Token Information
                            </div>
                            <div className="flex flex-row justify-between items-center mb-2">
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                    Type:
                                </span>
                                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                    {tokenInfo.type}
                                </span>
                            </div>
                            <div className="flex flex-row justify-between items-center mb-2">
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                    Name:
                                </span>
                                <span className="text-xs font-medium text-gray-900 dark:text-gray-100 flex-1 text-right">
                                    {tokenInfo.name}
                                </span>
                            </div>
                            <div className="flex flex-row justify-between items-center mb-2">
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                    Symbol:
                                </span>
                                <span className="text-xs font-medium text-gray-900 dark:text-gray-100 flex-1 text-right">
                                    {tokenInfo.symbol}
                                </span>
                            </div>
                            {tokenInfo.decimals !== undefined && (
                                <div className="flex flex-row justify-between items-center">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                        Decimals:
                                    </span>
                                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                        {tokenInfo.decimals}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <button
                    disabled={!tokenInfo || !!tokenError}
                    onClick={e => {
                        e.preventDefault();
                        onAddPress();
                    }}
                    className={
                        'btn btn-primary w-full mb-3 mt-10 ' +
                        (!tokenInfo || !!tokenError ? 'btn-disabled' : '')
                    }>
                    ADD
                </button>
            </div>
        </Modal>
    );
});
