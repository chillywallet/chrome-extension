import { JsonRpcProvider } from 'ethers';
import React, { useCallback, useMemo, useState } from 'react';
import { ChainData } from '../../shared/types/Chain';
import eventManager from '../../shared/utils/eventManager';
import { getRpcUrlByNetwork } from '../../shared/utils/rpc';
import { setPreferences } from '../../store/actions/uiActions';
import { usePreferences } from '../../store/selectors';
import { useAppDispatch } from '../../store/store';
import Header from './Header';
import Modal from './Modal';
import TextInput from './TextInput';
import Toast from './Toast';

type Props = {
    visible: boolean;
    onClosePress: () => void;
    network: ChainData;
};

export default React.memo<Props>((props: Props) => {
    const { visible, onClosePress, network } = props;
    const dispatch = useAppDispatch();
    const { customNetworks = [], rpcUrls = {} } = usePreferences();

    const [url, setUrl] = useState(
        getRpcUrlByNetwork(network, {
            rpcUrls,
            customNetworks,
        }) || '',
    );
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const defaultRpcUrl = useMemo(() => {
        return getRpcUrlByNetwork(network, {
            rpcUrls,
            customNetworks,
            skipUserRpcUrl: true,
        });
    }, [network, rpcUrls, customNetworks]);

    const isCustom = useMemo(() => {
        return customNetworks.some(cn => cn.chain_id === network.chain_id);
    }, [customNetworks, network.chain_id]);

    const validateRpcUrl = useCallback(
        async (url: string): Promise<{ isValid: boolean; message: string }> => {
            if (!url.trim()) {
                return { isValid: false, message: 'Please enter a valid RPC URL' };
            }

            try {
                // Create a provider with the test URL
                const provider = new JsonRpcProvider(url.trim());

                // Add timeout to prevent hanging requests
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
                });

                // First, check if the endpoint returns the correct chain ID
                const chainIdPromise = provider.getNetwork().then(net => net.chainId);
                const actualChainId = await Promise.race([chainIdPromise, timeoutPromise]);

                if (actualChainId !== BigInt(network.chain_id)) {
                    const _isValid = await new Promise(resolve => {
                        if (process.env.BUILD_TYPE === 'Prod') {
                            return resolve(false);
                        } else {
                            eventManager.showAlertModal({
                                title: 'Network Mismatch Detected',
                                message:
                                    `The RPC URL you entered belongs to a different network (Chain ID: ${actualChainId?.toString?.() ?? actualChainId}). ` +
                                    `Please verify the RPC URL or confirm if you want to use it for ${network.name}.`,
                                buttons: [
                                    {
                                        name: 'Use Anyway',
                                        type: 'primary',
                                        onPress: () => resolve(true),
                                    },
                                    {
                                        name: 'Cancel',
                                        type: 'cancel',
                                        onPress: () => resolve(false),
                                    },
                                ],
                            });
                        }
                    });

                    if (!_isValid) {
                        return {
                            isValid: false,
                            message:
                                'The RPC URL appears to be for a different network. Please verify it and try again.',
                        };
                    }
                }

                // Test with a known address (Ethereum Foundation address)
                const testAddress = '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe';

                // Try to get balance - this will fail if the RPC is invalid
                await Promise.race([provider.getBalance(testAddress), timeoutPromise]);

                return { isValid: true, message: 'RPC URL is valid' };
            } catch (error: any) {
                console.error('RPC URL validation failed:', error);
                return {
                    isValid: false,
                    message: 'Invalid RPC URL. Please check the URL and try again.',
                };
            } finally {
            }
        },
        [network],
    );

    const handleSave = useCallback(async () => {
        setErrorMessage(''); // Clear previous errors

        if (!url.trim()) {
            setErrorMessage('Please enter a valid RPC URL');
            return;
        }

        try {
            setIsLoading(true);

            // Only validate if the RPC URL is different from the default
            if (url.trim() !== defaultRpcUrl) {
                const result = await validateRpcUrl(url);

                if (!result.isValid) {
                    setErrorMessage(result.message);
                    return;
                }
            }

            // Remove the custom network if RPC URL is the same as default
            const existing = customNetworks.find(cn => cn.chain_id === network.chain_id);
            const updatedCustomNetworks = customNetworks.filter(
                cn => cn.chain_id !== network.chain_id,
            );

            // Only add if it's different from the default
            if (url.trim() !== defaultRpcUrl) {
                // Spread the existing entry first so a dataProvider override set in
                // Developer Settings survives an RPC change.
                updatedCustomNetworks.push({
                    ...existing,
                    chain_id: network.chain_id,
                    rpcUrl: url.trim(),
                });
            } else if (existing?.dataProvider) {
                // Back to the default RPC, but keep the provider override alive.
                updatedCustomNetworks.push({
                    chain_id: network.chain_id,
                    dataProvider: existing.dataProvider,
                });
            }

            await dispatch(setPreferences({ customNetworks: updatedCustomNetworks }));
            Toast.showSuccess('RPC URL updated successfully');
            onClosePress();
        } catch (error: any) {
            const message = error?.message || 'Failed to update RPC URL';
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, url, network, customNetworks, onClosePress, validateRpcUrl, defaultRpcUrl]);

    const handleReset = useCallback(async () => {
        setErrorMessage(''); // Clear previous errors

        try {
            setIsLoading(true);

            // Drop the custom RPC so the committed default applies again, but preserve
            // any data-provider override for this chain.
            const existing = customNetworks.find(cn => cn.chain_id === network.chain_id);
            const updatedCustomNetworks = customNetworks.filter(
                cn => cn.chain_id !== network.chain_id,
            );

            if (existing?.dataProvider) {
                updatedCustomNetworks.push({
                    chain_id: network.chain_id,
                    dataProvider: existing.dataProvider,
                });
            }

            await dispatch(setPreferences({ customNetworks: updatedCustomNetworks }));

            setUrl(defaultRpcUrl || '');
            Toast.showSuccess('RPC URL reset to default');
            onClosePress();
        } catch (error: any) {
            const message = error?.message || 'Failed to reset RPC URL';
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, network, customNetworks, onClosePress, defaultRpcUrl]);

    return (
        <Modal visible={visible} onClose={onClosePress}>
            <Header title="Customize Network" hasBackButton={false} onClosePress={onClosePress} />

            <div className="p-5">
                <div className="mb-4">
                    <div className="flex items-center mb-3">
                        <img src={network.icon} className="w-6 h-6 rounded-full mr-2" alt="icon" />
                        <h3 className="text-lg font-semibold">{network.name}</h3>
                    </div>

                    {isCustom && (
                        <div className="mb-3 p-2 bg-yellow-100 dark:bg-yellow-900 rounded text-sm">
                            ⚠️ Using custom RPC URL
                        </div>
                    )}
                </div>

                <div className="mb-4">
                    <TextInput
                        label="RPC URL"
                        value={url}
                        onChange={e => {
                            setUrl(e.target.value);
                            setErrorMessage(''); // Clear error when user types
                        }}
                        placeholder="Enter RPC URL"
                    />
                </div>

                {errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <div className="flex items-center">
                            <svg
                                className="w-4 h-4 text-red-500 mr-2 flex-shrink-0"
                                fill="currentColor"
                                viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <span className="text-sm text-red-700 dark:text-red-400">
                                {errorMessage}
                            </span>
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={handleReset}
                        disabled={isLoading || !isCustom}
                        className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                        Reset to Default
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="flex-1 btn disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </Modal>
    );
});
