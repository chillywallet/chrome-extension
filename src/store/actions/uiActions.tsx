import { PermissionsRequest } from '@metamask/permission-controller';
import { parseUnits, TransactionResponse } from 'ethers';
import { isArray } from 'lodash';
import { Hex } from 'viem';
import { getCustomGasPrice } from '../../api';
import { Contact } from '../../api/graphQL/Types';
import { DataProviderConfig } from '../../config/types';
import { AcceptOptions } from '../../controller/ApprovalController';
import { getCurrentChainByChain } from '../../lib/ChainsUtils';
import { serializeBigInt } from '../../lib/bigintSerializer';
import { SendCallsParams } from '../../lib/eip5792/types';
import { LiquidStakingProviders } from '../../lib/liquid-staking';
import { LiquidStakingData, LiquidStakingRequest } from '../../lib/liquid-staking/Types';
import { RECENT_CONTACTS_LIMIT } from '../../shared/constants/number';
import { Chain, ChainData, GasPriceType } from '../../shared/types/Chain';
import { EarnType } from '../../shared/types/Earn';
import { RemoteData } from '../../shared/types/Global';
import { ExploreTabType } from '../../shared/types/Home';
import { OnboardingStep } from '../../shared/types/Onboarding';
import { TransactionMeta, TransactionParams } from '../../shared/types/Transaction';
import {
    Asset,
    CachingCoin,
    Coin,
    CoinPrice,
    GasInfo,
    GasOptionsData,
    GasType,
    MarketCoinPrice,
    NFTList,
    PendingTransaction,
    PlatformCoin,
    Transaction,
    TransactionRequestParam,
    TxtStatus,
} from '../../shared/types/Wallet';
import logger from '../../shared/utils/logger';
import { generateActionId, submitRequestToBackground } from '../backgroundConnection';
import { GlobalState } from '../reducers/globalReducer';
import { getReduxStore, ReduxState, ReduxStore } from '../store';
import {
    SET_COIN_PRICES,
    SET_PORTFOLIO_COINS,
    setGlobalState,
    setPortfolioNfts as setPortfolioNftsRedux,
    setPortfolioTransactions as setPortfolioTransactionsRedux,
    setTopCoinsByNetwork as setTopCoinsByNetworkRedux,
} from './globalActions';

export const SHOW_LOADING = 'SHOW_LOADING';
export const HIDE_LOADING = 'HIDE_LOADING';

export const UNLOCK_SUCCEEDED = 'UNLOCK_SUCCEEDED';
export const UNLOCK_FAILED = 'UNLOCK_FAILED';
export const LOCK_APP = 'LOCK_APP';

export const showLoadingIndicator = () => (dispatch: Function) => {
    dispatch({
        type: SHOW_LOADING,
    });
};

export const hideLoadingIndicator = () => (dispatch: Function) => {
    dispatch({
        type: HIDE_LOADING,
    });
};

export const updateStateFromBackground = () => async (dispatch: Function) => {
    logger.log('uiActions/updateStateFromBackground');

    try {
        let newState = await submitRequestToBackground<ReduxState['globalState']>('getState');
        dispatch(updateGlobalState(newState));
        return newState;
    } catch (error) {
        throw error;
    }
};

export const updatePortfolioCoinsFromBackground =
    (address: string, platform_id: number) => async (dispatch: Function) => {
        logger.log('uiActions/updatePortfolioCoinsFromBackground');

        const coins = await getCurrentPortfolioCoins(address, platform_id);
        dispatch({
            type: SET_PORTFOLIO_COINS,
            address: address.toLowerCase(),
            platform_id,
            portfolioCoins: coins,
        });
    };

export const updateCoinPricesFromBackground =
    (platform_id: number) => async (dispatch: Function) => {
        logger.log('uiActions/updateCoinPricesFromBackground');

        const prices = await getCurrentCoinPrices(platform_id);
        dispatch({
            type: SET_COIN_PRICES,
            platform_id,
            coinPrices: prices,
        });
        return prices;
    };

// Only update the state that have different values.
const updateState = (oldState: GlobalState, newState: GlobalState) => {
    Object.keys(newState).forEach((key: string) => {
        //@ts-ignore
        const _value = newState[key];
        //@ts-ignore
        const _oldValue = oldState[key];
        const typeOfValue = typeof _value;

        if (typeOfValue !== 'object' || _value === null || isArray(_value)) {
            if (
                !isArray(_value) ||
                !isArray(_oldValue) ||
                JSON.stringify(serializeBigInt(_value)) !==
                    JSON.stringify(serializeBigInt(_oldValue))
            ) {
                if (_value !== _oldValue) {
                    //@ts-ignore
                    oldState[key] = _value;
                }
            }
        } else if (!_oldValue) {
            //@ts-ignore
            oldState[key] = _value;
        } else if (
            JSON.stringify(serializeBigInt(_value)) !== JSON.stringify(serializeBigInt(_oldValue))
        ) {
            //@ts-ignore
            oldState[key] = _value;
        }
    });

    return oldState;
};

export const updateGlobalState =
    (newState: ReduxState['globalState']) =>
    (dispatch: Function, getState: ReduxStore['getState']) => {
        const oldState = getState();
        const updatedState = updateState(oldState.globalState, newState);
        dispatch(setGlobalState(updatedState));
    };

export const unlockApp =
    (password: string, cb: (err: boolean, errMessage?: string) => void) =>
    async (dispatch: Function) => {
        logger.log('uiActions/unlockApp');

        dispatch(showLoadingIndicator());
        try {
            await submitRequestToBackground<void>('submitPassword', [password]);
            await dispatch(updateStateFromBackground());
            cb(false);
        } catch (error: any) {
            cb(true, error?.message);
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const lockApp = () => async (dispatch: Function) => {
    logger.log('uiActions/lockApp');

    dispatch(showLoadingIndicator());
    try {
        await submitRequestToBackground('setLocked', []);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        throw error;
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export const verifyPassword = (password: string) => async (dispatch: Function) => {
    logger.log('uiActions/verifyPassword');

    dispatch(showLoadingIndicator());

    try {
        await submitRequestToBackground('verifyPassword', [password]);
    } catch (error) {
        throw error;
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export async function getSeedPhrase(password: string, walletId?: string) {
    logger.log('uiActions/getSeedPhrase');

    const encodedSeedPhrase = await submitRequestToBackground<string>('getSeedPhrase', [
        password,
        walletId,
    ]);
    //@ts-ignore
    return Buffer.from(encodedSeedPhrase).toString('utf8');
}

export const importWallet =
    (password: string, seedPhrase: string, isPrivateKey: boolean = false) =>
    async (dispatch: Function) => {
        logger.log('uiActions/importWallet');
        dispatch(showLoadingIndicator());

        try {
            if (isPrivateKey) {
                await submitRequestToBackground('createNewVaultAndRestoreWithPrivateKey', [
                    password,
                    seedPhrase,
                ]);
            } else {
                const encodedSeedPhrase = Array.from(Buffer.from(seedPhrase, 'utf8').values());
                await submitRequestToBackground('createNewVaultAndRestore', [
                    password,
                    encodedSeedPhrase,
                ]);
            }
        } catch (error: any) {
            if (error?.message) {
                let message = error.message;

                if (message === 'Eth-Hd-Keyring: Invalid secret recovery phrase provided') {
                    message =
                        'This is not a valid BIP39 compliant seed phrase. Please check your spelling.';
                }
                throw new Error(message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const addNewWallet =
    (seedPhrase?: string, isPrivateKey: boolean = false) =>
    async (dispatch: Function) => {
        logger.log('uiActions/addNewWallet');
        dispatch(showLoadingIndicator());

        try {
            if (isPrivateKey) {
                return await submitRequestToBackground<string>('addNewWalletWithPrivateKey', [
                    seedPhrase,
                ]);
            } else {
                const encodedSeedPhrase = seedPhrase
                    ? Array.from(Buffer.from(seedPhrase, 'utf8').values())
                    : undefined;

                const _encodedSeedPhrase = await submitRequestToBackground<string>('addNewWallet', [
                    encodedSeedPhrase,
                    isPrivateKey,
                ]);
                return Buffer.from(_encodedSeedPhrase).toString('utf8');
            }
        } catch (error: any) {
            if (error?.message) {
                let message = error.message;

                if (message === 'Eth-Hd-Keyring: Invalid secret recovery phrase provided') {
                    message =
                        'This is not a valid BIP39 compliant seed phrase. Please check your spelling.';
                }

                throw new Error(message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const clearLedgerHardwarePreviewSession = () => async () => {
    logger.log('uiActions/clearLedgerHardwarePreviewSession');
    await submitRequestToBackground<void>('clearLedgerHardwarePreviewSession', []);
};

export const getLedgerHardwareAddressPage =
    (direction: 'first' | 'next' | 'prev', ledgerWalletId?: string | null) =>
    async (_dispatch: Function) => {
        logger.log('uiActions/getLedgerHardwareAddressPage', direction, ledgerWalletId);
        return submitRequestToBackground<{ address: string; index: number }[]>(
            'getLedgerHardwareAddressPage',
            [direction, ledgerWalletId],
        );
    };

export const importLedgerHardwareAccounts =
    (
        indices: number[],
        ledgerWalletId?: string | null,
        vaultPassword?: string | null,
        addressesKnownFromUi?: string[] | null,
    ) =>
    async (dispatch: Function) => {
        logger.log('uiActions/importLedgerHardwareAccounts', { ledgerWalletId });
        dispatch(showLoadingIndicator());
        try {
            await submitRequestToBackground<string[]>('importLedgerHardwareAccounts', [
                indices,
                ledgerWalletId,
                vaultPassword ?? null,
                addressesKnownFromUi ?? null,
            ]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const clearTrezorHardwarePreviewSession = () => async () => {
    logger.log('uiActions/clearTrezorHardwarePreviewSession');
    await submitRequestToBackground<void>('clearTrezorHardwarePreviewSession', []);
};

export const getTrezorHardwareAddressPage =
    (direction: 'first' | 'next' | 'prev', trezorWalletId?: string | null) =>
    async (_dispatch: Function) => {
        logger.log('uiActions/getTrezorHardwareAddressPage', direction, trezorWalletId);
        return submitRequestToBackground<{ address: string; index: number }[]>(
            'getTrezorHardwareAddressPage',
            [direction, trezorWalletId],
        );
    };

export const importTrezorHardwareAccounts =
    (
        indices: number[],
        trezorWalletId?: string | null,
        vaultPassword?: string | null,
        addressesKnownFromUi?: string[] | null,
    ) =>
    async (dispatch: Function) => {
        logger.log('uiActions/importTrezorHardwareAccounts', trezorWalletId);
        dispatch(showLoadingIndicator());
        try {
            await submitRequestToBackground<string[]>('importTrezorHardwareAccounts', [
                indices,
                trezorWalletId,
                vaultPassword ?? null,
                addressesKnownFromUi ?? null,
            ]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const createWalletAndGetSeedPhrase = (password: string) => async (dispatch: Function) => {
    logger.log('uiActions/createWalletAndGetSeedPhrase');
    dispatch(showLoadingIndicator());

    try {
        await submitRequestToBackground<string>('createNewVaultAndKeychain', [password]);
        const seedPhrase = await getSeedPhrase(password);
        return seedPhrase;
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export const getPrivateKey = (password: string, address: string) => async (dispatch: Function) => {
    logger.log('uiActions/getPrivateKey');
    dispatch(showLoadingIndicator());

    try {
        const _privateKey = await submitRequestToBackground<string>('exportAccount', [
            password,
            address,
        ]);
        return _privateKey;
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export const removeAccount = (address: string) => async (dispatch: Function) => {
    logger.log('uiActions/removeAccount');
    dispatch(showLoadingIndicator());

    try {
        await submitRequestToBackground<string>('removeAccount', [address]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export const removeWallet = (walletId: string) => async (dispatch: Function) => {
    logger.log('uiActions/removeWallet');
    dispatch(showLoadingIndicator());

    try {
        await submitRequestToBackground<string>('removeWallet', [walletId]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export const addNewAccount =
    (walletId: string, name: string, avatar: string) =>
    async (dispatch: Function, getState: ReduxStore['getState']) => {
        logger.log('uiActions/addNewAccount');
        dispatch(showLoadingIndicator());

        const keyrings = getState().globalState.keyrings;
        const findKeyring = keyrings.find(keyring => keyring.id === walletId);

        try {
            const addedAccountAddress = await submitRequestToBackground('addNewAccount', [
                findKeyring?.accounts.length ?? 1,
                walletId,
            ]);
            await submitRequestToBackground('updateAccount', [
                addedAccountAddress,
                name,
                avatar,
                false,
            ]);
            await dispatch(updateStateFromBackground());
            return addedAccountAddress;
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const updateAccount =
    (address: string, name: string, avatar: string, isSmartWallet: boolean) =>
    async (dispatch: Function) => {
        logger.log('uiActions/updateAccount');
        dispatch(showLoadingIndicator());

        try {
            await submitRequestToBackground('updateAccount', [
                address,
                name,
                avatar,
                isSmartWallet,
            ]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const updateWallet = (walletId: string, name: string) => async (dispatch: Function) => {
    logger.log('uiActions/updateWallet');
    dispatch(showLoadingIndicator());

    try {
        await submitRequestToBackground('updateWallet', [walletId, name]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export const setSelectedAccount = (accountId: string) => async (dispatch: Function) => {
    logger.log('uiActions/setSelectedAccount');
    dispatch(showLoadingIndicator());

    try {
        await submitRequestToBackground('setSelectedAccount', [accountId]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export const setSelectedWallet = (walletId: string) => async (dispatch: Function) => {
    logger.log('uiActions/setSelectedWallet');
    dispatch(showLoadingIndicator());

    try {
        await submitRequestToBackground('setSelectedWallet', [walletId]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export const setCompletedOnboarding =
    (hasLoader: boolean = true) =>
    async (dispatch: Function) => {
        logger.log('uiActions/setCompletedOnboarding');
        hasLoader && dispatch(showLoadingIndicator());

        try {
            const addedAccountAddress = await submitRequestToBackground('completeOnboarding', []);
            await dispatch(updateStateFromBackground());
            return addedAccountAddress;
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            hasLoader && dispatch(hideLoadingIndicator());
        }
    };

export const setDarkMode = (darkMode: boolean) => async (dispatch: Function) => {
    logger.log('uiActions/setDarkMode', darkMode);

    try {
        await submitRequestToBackground('setPreference', ['darkMode', darkMode]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    }
};

export const setDarkModeSystem = (darkModeSystem: boolean) => async (dispatch: Function) => {
    logger.log('uiActions/setDarkModeSystem', darkModeSystem);

    try {
        await submitRequestToBackground('setPreference', ['darkModeSystem', darkModeSystem]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    }
};

export const setPreferColorScheme =
    (preferColorScheme: 'no-preference' | 'light' | 'dark') => async (dispatch: Function) => {
        logger.log('uiActions/setPreferColorScheme', preferColorScheme);

        try {
            await submitRequestToBackground('setPreference', [
                'preferColorScheme',
                preferColorScheme,
            ]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const setAppIcon = (appIcon: string) => async (dispatch: Function) => {
    logger.log('uiActions/setAppIcon', appIcon);

    try {
        await submitRequestToBackground('setPreference', ['appIcon', appIcon]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    }
};

export const setRemoteData = (data: RemoteData) => async (dispatch: Function) => {
    logger.log('uiActions/setRemoteData', data);

    try {
        await submitRequestToBackground('setPreferences', [data]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    }
};

export const setDefaultExploreTab =
    (defaultExploreTab: ExploreTabType) => async (dispatch: Function) => {
        logger.log('uiActions/setDefaultExploreTab', defaultExploreTab);

        try {
            await submitRequestToBackground('setPreferences', [{ defaultExploreTab }]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const setNftCollectionsHideStatus =
    (nftCollectionsHideStatus: { [key: string]: boolean }) => async (dispatch: Function) => {
        logger.log('uiActions/setNftCollectionsHideStatus', nftCollectionsHideStatus);

        try {
            await submitRequestToBackground('setPreferences', [{ nftCollectionsHideStatus }]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const setNftsHideStatus =
    (nftsHideStatus: { [key: string]: boolean }) => async (dispatch: Function) => {
        logger.log('uiActions/setNftsHideStatus', nftsHideStatus);

        try {
            await submitRequestToBackground('setPreferences', [{ nftsHideStatus }]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const setExploreRedDot =
    (exploreRedDot: boolean, exploreRedDotDate?: string) => async (dispatch: Function) => {
        logger.log('uiActions/setExploreRedDot', exploreRedDot);

        try {
            await submitRequestToBackground('setPreferences', [
                exploreRedDotDate ? { exploreRedDot, exploreRedDotDate } : { exploreRedDot },
            ]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const setFavoriteCoins =
    (favoriteCoins: MarketCoinPrice[]) => async (dispatch: Function) => {
        logger.log('uiActions/setFavoriteCoins', favoriteCoins);

        try {
            await submitRequestToBackground('setPreferences', [{ favoriteCoins }]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const setHideTestnetBadge = (hideTestnetBadge: boolean) => async (dispatch: Function) => {
    logger.log('uiActions/setHideTestnetBadge', hideTestnetBadge);

    try {
        await submitRequestToBackground('setPreference', ['hideTestnetBadge', hideTestnetBadge]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    }
};

export const setUseDefaultNetwork = (useDefaultNetwork: boolean) => async (dispatch: Function) => {
    logger.log('uiActions/setUseDefaultNetwork', useDefaultNetwork);

    try {
        await submitRequestToBackground('setPreferences', [{ useDefaultNetwork }]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    }
};

/**
 * Store a user-supplied data-provider API key. Never logs the key itself.
 */
export const setApiKey =
    (apiKeyRef: string, apiKey: string) => async (dispatch: Function) => {
        logger.log('uiActions/setApiKey', apiKeyRef, apiKey ? '(set)' : '(cleared)');

        try {
            await submitRequestToBackground('setApiKey', [apiKeyRef, apiKey]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

/** Override the data provider for a chain; pass null to restore the committed default. */
export const setChainDataProvider =
    (chainId: number, dataProvider: DataProviderConfig | null) => async (dispatch: Function) => {
        logger.log('uiActions/setChainDataProvider', chainId, dataProvider?.kind ?? 'default');

        try {
            await submitRequestToBackground('setChainDataProvider', [chainId, dataProvider]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const setPreferences = (preferences: Record<string, any>) => async (dispatch: Function) => {
    logger.log('uiActions/setPreferences', preferences);

    try {
        await submitRequestToBackground('setPreferences', [preferences]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    }
};

export const setCachingCoins = (coins: CachingCoin[]) => async (dispatch: Function) => {
    logger.log('uiActions/setCachingCoins');
    try {
        await submitRequestToBackground('setCachingCoins', [coins]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    }
};

export const setUnknownCoins = (coinIds: string[]) => async (dispatch: Function) => {
    logger.log('uiActions/setUnknownCoins');
    try {
        await submitRequestToBackground('setUnknownCoins', [coinIds]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    }
};

export const setTopCoinsByNetwork =
    (platform_id: number, coins: PlatformCoin[]) => (dispatch: Function) => {
        logger.log('uiActions/setTopCoinsByNetwork');
        dispatch(setTopCoinsByNetworkRedux(platform_id, coins));
    };

export const setNativeCoinPrice =
    (platform_id: number, price: number) => async (dispatch: Function) => {
        logger.log('uiActions/setNativeCoinPrice');
        try {
            await submitRequestToBackground('setNativeCoinPrice', [platform_id, price]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const setPortfolioCoins =
    (address: string, platform_id: number, coins: Coin[]) => async (dispatch: Function) => {
        logger.log('uiActions/setPortfolioCoins');
        try {
            await submitRequestToBackground('setPortfolioCoins', [
                address.toLowerCase(),
                platform_id,
                coins,
            ]);
            await dispatch(updatePortfolioCoinsFromBackground(address, platform_id));
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const updatePortfolioCoins =
    (address: string, platform_id: number, coins: Coin[]) => async (dispatch: Function) => {
        logger.log('uiActions/updatePortfolioCoins');
        try {
            await submitRequestToBackground('updatePortfolioCoins', [
                address.toLowerCase(),
                platform_id,
                coins,
            ]);
            await dispatch(updatePortfolioCoinsFromBackground(address, platform_id));
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const getCurrentPortfolioCoins = async (address: string, platform_id: number) => {
    logger.log('uiActions/getCurrentPortfolioCoins');
    return await submitRequestToBackground<Coin[]>('getCurrentPortfolioCoins', [
        address.toLowerCase(),
        platform_id,
    ]);
};

export const getCurrentCoinPrices = async (platform_id: number) => {
    logger.log('uiActions/getCurrentCoinPrices');
    return await submitRequestToBackground<CoinPrice>('getCurrentCoinPrices', [platform_id]);
};

export const getCoinByTokenAddress = async (
    address: string,
    platform_id: number,
    tokenAddress: string,
) => {
    logger.log('uiActions/getCoinByTokenAddress');
    return await submitRequestToBackground<Coin | undefined>('getCoinByTokenAddress', [
        address.toLowerCase(),
        platform_id,
        tokenAddress,
    ]);
};

export const setCoinPrices =
    (platform_id: number, prices: CoinPrice) => async (dispatch: Function) => {
        logger.log('uiActions/setCoinPrices');
        try {
            await submitRequestToBackground('setCoinPrices', [platform_id, prices]);
            await dispatch(updateCoinPricesFromBackground(platform_id));
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const setPortfolioNfts =
    (address: string, platform_id: number, nfts: NFTList[]) => (dispatch: Function) => {
        logger.log('uiActions/setPortfolioNfts');
        dispatch(setPortfolioNftsRedux(address, platform_id, nfts));
    };

export const setPortfolioTransactions =
    (address: string, platform_id: number, transactions: Transaction[]) => (dispatch: Function) => {
        logger.log('uiActions/setPortfolioTransactions');
        dispatch(setPortfolioTransactionsRedux(address, platform_id, transactions));
    };

export const setPendingTransactions =
    (address: string, platform_id: number, transactions: PendingTransaction[]) =>
    async (dispatch: Function) => {
        logger.log('uiActions/setPendingTransactions');
        try {
            await submitRequestToBackground('setPendingTransactions', [
                address.toLowerCase(),
                platform_id,
                transactions,
            ]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const addPendingTransaction =
    (platform_id: number, transaction: PendingTransaction) => async (dispatch: Function) => {
        logger.log('uiActions/addPendingTransaction');
        transaction.createdAt = Date.now();

        try {
            await submitRequestToBackground('addPendingTransaction', [platform_id, transaction]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            logger.error('addPendingTransaction error', error);
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const updatePendingTransactionStatus =
    (platform_id: number, transaction: PendingTransaction) => async (dispatch: Function) => {
        logger.log('uiActions/updatePendingTransactionStatus');
        try {
            const status = await submitRequestToBackground<TxtStatus>(
                'updatePendingTransactionStatus',
                [platform_id, transaction],
            );
            await dispatch(updateStateFromBackground());
            return status;
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const updatePendingTransaction =
    (platform_id: number, transaction: PendingTransaction) => async (dispatch: Function) => {
        logger.log('uiActions/updatePendingTransaction');
        try {
            await submitRequestToBackground('updatePendingTransaction', [platform_id, transaction]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const removePendingTransactions =
    (address: string, platform_id: number, ids: string[]) => async (dispatch: Function) => {
        logger.log('uiActions/removePendingTransactions');
        try {
            await submitRequestToBackground('removePendingTransactions', [
                address.toLowerCase(),
                platform_id,
                ids,
            ]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const removeCompletedTransactions =
    (address: string, platform_id: number) => async (dispatch: Function) => {
        logger.log('uiActions/removeCompletedTransactions');
        try {
            await submitRequestToBackground('removeCompletedTransactions', [
                address.toLowerCase(),
                platform_id,
            ]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const setOnboardingStep = async (onboardingStep: OnboardingStep) => {
    logger.log('uiActions/setOnboardingStep');
    await submitRequestToBackground('setOnboardingStep', [onboardingStep]);
};

export const setContacts =
    (contacts: Contact[], hasLoader: boolean = true) =>
    async (dispatch: Function) => {
        logger.log('uiActions/setContacts');

        try {
            await submitRequestToBackground('setContacts', [contacts]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        }
    };

export const addRecentContact =
    async (address: string, name: string, emoji: string) =>
    async (dispatch: Function, getState: ReduxStore['getState']) => {
        logger.log('uiActions/addRecentContact');
        try {
            const recentContacts = getState().globalState.recentContacts;
            const findIndex = recentContacts.findIndex(
                contact => contact.walletAddress.toLowerCase() === address.toLowerCase(),
            );

            if (findIndex >= 0) {
                return;
            }

            const newRecentContacts = [
                ...recentContacts,
                {
                    walletAddress: address,
                    name,
                    avatar: emoji,
                },
            ];

            // Limit the max number of recent contacts
            if (newRecentContacts.length > RECENT_CONTACTS_LIMIT) {
                newRecentContacts.shift();
            }

            await submitRequestToBackground('setRecentContacts', [newRecentContacts]);
        } catch (error) {
            logger.error('addRecentContact', error);
        }
    };

export const setSelectedNetwork = (chainId: number) => async (dispatch: Function) => {
    logger.log('uiActions/setSelectedNetwork');

    try {
        await submitRequestToBackground('setSelectedNetwork', [chainId]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    } finally {
    }
};

export const getNextAvailableAccountName = async () => {
    logger.log('uiActions/getNextAvailableAccountName');

    try {
        return await submitRequestToBackground<string>('getNextAvailableAccountName', []);
    } catch (error: any) {
        logger.error('getNextAvailableAccountName', error);
    }

    return '';
};

export const approveAllowance = async (
    spenderAddress: string,
    walletAddress: string,
    tokenAddress: string,
    spenderAmount: string,
    network: ChainData,
    gasInfo: GasInfo,
    infiniteApproval: boolean,
) => {
    logger.log('uiActions/approveAllowance');
    return await submitRequestToBackground<Promise<TransactionResponse>>('approveAllowance', [
        spenderAddress,
        walletAddress,
        tokenAddress,
        spenderAmount,
        network,
        gasInfo,
        infiniteApproval,
    ]);
};

export const checkAllowance = async (
    spenderAddress: string,
    walletAddress: string,
    tokenAddress: string,
    spenderAmount: string | null,
) => {
    logger.log('uiActions/checkAllowance');
    return await submitRequestToBackground<boolean>('checkAllowance', [
        spenderAddress,
        walletAddress,
        tokenAddress,
        spenderAmount,
    ]);
};

export const estimateGasAllowance = async (
    spenderAddress: string,
    tokenAddress: string,
    spenderAmount: string | null,
    walletAddress: string,
) => {
    logger.log('uiActions/estimateGasAllowance');
    return await submitRequestToBackground<boolean>('estimateGasAllowance', [
        spenderAddress,
        tokenAddress,
        spenderAmount,
        walletAddress,
    ]);
};

export const estimateGasLimit = async (
    asset: Asset,
    address: string,
    recipient: string,
    amount: bigint,
    padding?: number,
) => {
    logger.log('uiActions/estimateGasLimit');
    return await submitRequestToBackground<string | null>('estimateGasLimit', [
        asset,
        address,
        recipient,
        amount.toString(),
        padding,
    ]);
};

export const estimateGas = async (txParams: TransactionParams) => {
    logger.log('uiActions/estimateGas');
    return await submitRequestToBackground<string | null>('estimateGas', [txParams]);
};

export const estimateWalletSendCallsGas = async (payload: SendCallsParams, from: string) => {
    logger.log('uiActions/estimateWalletSendCallsGas');
    return await submitRequestToBackground<number>('estimateWalletSendCallsGas', [payload, from]);
};

export const getTokenBalance = async (
    walletAddress: string,
    tokenAddress: string | undefined,
    nativeCoin: boolean,
    chainId?: number,
) => {
    chainId = chainId ?? getReduxStore()?.getState()?.globalState?.selectedNetwork?.chain_id;
    logger.log('uiActions/getTokenBalance');
    return await submitRequestToBackground<{
        balance: bigint;
        decimals: number;
        error: boolean;
    }>('getTokenBalance', [walletAddress, tokenAddress, nativeCoin, chainId]);
};

export const getNativeTokenBalance =
    (walletAddress: string, chainId?: number) =>
    async (dispatch: Function, getState: ReduxStore['getState']) => {
        chainId = chainId ?? getState()?.globalState?.selectedNetwork?.chain_id;

        logger.log('uiActions/getNativeTokenBalance');
        const balance = await submitRequestToBackground<bigint>('getNativeTokenBalance', [
            walletAddress,
            chainId,
        ]);
        dispatch(updateStateFromBackground());
        return balance;
    };

export const newSendTransaction = async (
    accountAddress: string,
    params: TransactionRequestParam,
) => {
    logger.log('uiActions/newSendTransaction');
    return await submitRequestToBackground<TransactionResponse | null>('newSendTransaction', [
        accountAddress,
        params,
    ]);
};

export const sendTransaction =
    (
        accountAddress: string,
        receipient: string,
        gasInfo: GasInfo,
        gasLimit: number,
        amount: bigint,
        asset: Asset,
        isAAWallet: boolean,
    ) =>
    async (dispatch: Function) => {
        logger.log('uiActions/sendTransaction');
        dispatch(showLoadingIndicator());

        try {
            return await submitRequestToBackground<TransactionResponse | null>('sendTransaction', [
                accountAddress,
                receipient,
                gasInfo,
                gasLimit,
                amount.toString(),
                asset,
                isAAWallet,
            ]);
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const speedUpTransaction =
    (accountAddress: string, pendingTransaction: TransactionResponse, gasInfo: GasInfo) =>
    async (dispatch: Function) => {
        logger.log('uiActions/speedUpTransaction');
        dispatch(showLoadingIndicator());

        try {
            return await submitRequestToBackground<TransactionResponse | null>(
                'speedUpTransaction',
                [accountAddress, pendingTransaction, gasInfo],
            );
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const getTransaction = async (txHash: string, chain_id: number | null = null) => {
    logger.log('uiActions/getTransaction');
    return await submitRequestToBackground<TransactionResponse>('getTransaction', [
        txHash,
        chain_id,
    ]);
};

export const cancelTransaction =
    (accountAddress: string, pendingTransaction: TransactionResponse, gasInfo: GasInfo) =>
    async (dispatch: Function) => {
        logger.log('uiActions/cancelTransaction');
        dispatch(showLoadingIndicator());

        try {
            return await submitRequestToBackground<TransactionResponse | null>(
                'cancelTransaction',
                [accountAddress, pendingTransaction, gasInfo],
            );
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const ensToWalletAdress = async (ensName: string) => {
    logger.log('uiActions/ensToWalletAdress');
    return await submitRequestToBackground<TransactionResponse | null>('ensToWalletAdress', [
        ensName,
    ]);
};

export const setCustomGas = (data: GasInfo, network: ChainData) => async (dispatch: Function) => {
    logger.log('uiActions/setCustomGas');

    try {
        await submitRequestToBackground('setCustomGas', [data, network]);
        dispatch(updateStateFromBackground());
    } catch (error: any) {
        logger.error('setCustomGas', error);
    }
};

export const setGasType = (data: GasType, network: ChainData) => async (dispatch: Function) => {
    logger.log('uiActions/setGasType');

    try {
        await submitRequestToBackground('setGasType', [data, network]);
        dispatch(updateStateFromBackground());
    } catch (error: any) {
        logger.error('setGasType', error);
    }
};

export const setGasOptionsData =
    (data: GasOptionsData, network: ChainData) => async (dispatch: Function) => {
        logger.log('uiActions/setGasOptionsData');

        try {
            await submitRequestToBackground('setGasOptionsData', [data, network]);
            dispatch(updateStateFromBackground());
        } catch (error: any) {
            logger.error('setGasOptionsData', error);
        }
    };

export const loadGasOptions =
    (chain: Chain) => async (dispatch: Function, getState: ReduxStore['getState']) => {
        logger.log('uiActions/loadGasOptions');
        const network = getCurrentChainByChain(chain);

        if (!network) {
            return;
        }

        try {
            const gasPriceSettings = getState().globalState.preferences.gasPrice;
            const gasPriceConfig = gasPriceSettings.find(
                item => item.chain_id === network.chain_id,
            );

            let useDefault = true;
            const localGasOptionsData = await submitRequestToBackground<GasOptionsData | undefined>(
                'loadGasOptions',
                [
                    network.chain_id,
                    gasPriceConfig
                        ? {
                              customPriorityFee: gasPriceConfig.customPriorityFee,
                              customGasPrice: gasPriceConfig.customGasPrice,
                          }
                        : undefined,
                ],
            );

            if (gasPriceConfig?.type === 'custom') {
                if (gasPriceConfig.url_pattern) {
                    const result = await getCustomGasPrice(gasPriceConfig.url_pattern);

                    if (result.data.message === 'OK') {
                        const data = result.data.result;

                        const remoteGasOptionsData: GasOptionsData = (() => {
                            if (network.gasPriceType === GasPriceType.BaseAndPriority) {
                                // For EIP-1559 networks
                                const baseFee = parseUnits(data.suggestBaseFee ?? '0', 'gwei');
                                const lowMaxFeePerGas = parseUnits(data.SafeGasPrice, 'gwei');
                                const mediumMaxFeePerGas = parseUnits(data.ProposeGasPrice, 'gwei');
                                const highMaxFeePerGas = parseUnits(data.FastGasPrice, 'gwei');

                                // If the current base fee is greater than the base fee, use the current base fee
                                const maxBaseFee =
                                    localGasOptionsData?.currentBaseFee &&
                                    localGasOptionsData?.currentBaseFee > baseFee
                                        ? localGasOptionsData?.currentBaseFee
                                        : baseFee;

                                return {
                                    low: {
                                        priorityFee: lowMaxFeePerGas - baseFee,
                                        baseFee: maxBaseFee,
                                        maxFeePerGas: lowMaxFeePerGas - baseFee + maxBaseFee,
                                    },
                                    medium: {
                                        priorityFee: mediumMaxFeePerGas - baseFee,
                                        baseFee: maxBaseFee,
                                        maxFeePerGas: mediumMaxFeePerGas - baseFee + maxBaseFee,
                                    },
                                    high: {
                                        priorityFee: highMaxFeePerGas - baseFee,
                                        baseFee: maxBaseFee,
                                        maxFeePerGas: highMaxFeePerGas - baseFee + maxBaseFee,
                                    },
                                    currentBaseFee: localGasOptionsData?.currentBaseFee,
                                };
                            } else {
                                // For legacy gas price networks
                                return {
                                    low: {
                                        gasPrice: parseUnits(data.SafeGasPrice, 'gwei'),
                                    },
                                    medium: {
                                        gasPrice: parseUnits(data.ProposeGasPrice, 'gwei'),
                                    },
                                    high: {
                                        gasPrice: parseUnits(data.FastGasPrice, 'gwei'),
                                    },
                                };
                            }
                        })();

                        logger.log('⛽️ Remote Gas Options', network.chain_id, remoteGasOptionsData);
                        dispatch(setGasOptionsData(remoteGasOptionsData, network));
                        useDefault = false;
                    }
                }
            }

            if (useDefault && localGasOptionsData) {
                dispatch(setGasOptionsData(localGasOptionsData, network));
            }
        } catch (error) {
            logger.error('loadGasOptions', error);
        }
    };

export const rejectPermissionsRequest = (requestId: string) => async (dispatch: Function) => {
    logger.log('uiActions/rejectPermissionsRequest');
    dispatch(showLoadingIndicator());

    try {
        await submitRequestToBackground('rejectPermissionsRequest', [requestId]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export const approvePermissionsRequest =
    (request: PermissionsRequest) => async (dispatch: Function) => {
        logger.log('uiActions/approvePermissionsRequest');
        dispatch(showLoadingIndicator());

        try {
            await submitRequestToBackground('approvePermissionsRequest', [request]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const removePermittedAccount =
    (origin: string, account: string) => async (dispatch: Function) => {
        logger.log('uiActions/removePermittedAccount');
        dispatch(showLoadingIndicator());

        try {
            await submitRequestToBackground('removePermittedAccount', [origin, account]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const addPermittedAccount =
    (origin: string, account: string) => async (dispatch: Function) => {
        logger.log('uiActions/addPermittedAccount');
        dispatch(showLoadingIndicator());

        try {
            await submitRequestToBackground('addPermittedAccount', [origin, account]);
            await submitRequestToBackground('notifyPermittedAccountsChanged');
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const resolvePendingApproval =
    (id: string, value?: unknown, options?: AcceptOptions) => async (dispatch: Function) => {
        logger.log('uiActions/resolvePendingApproval');
        dispatch(showLoadingIndicator());

        try {
            await submitRequestToBackground('resolvePendingApproval', [id, value, options]);
            await dispatch(updateStateFromBackground());
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const updateAndApproveTx = (txMeta: TransactionMeta) => async (dispatch: Function) => {
    logger.log('uiActions/updateAndApproveTx');
    dispatch(showLoadingIndicator());

    try {
        const actionId = generateActionId();
        await submitRequestToBackground('resolvePendingApproval', [
            txMeta.id,
            { txMeta, actionId },
            { waitForResult: true },
        ]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export const rejectPendingApproval = (id: string, error: any) => async (dispatch: Function) => {
    logger.log('uiActions/rejectPendingApproval');
    dispatch(showLoadingIndicator());

    try {
        await submitRequestToBackground('rejectPendingApproval', [id, error]);
        await dispatch(updateStateFromBackground());
    } catch (error: any) {
        if (error?.message) {
            throw new Error(error.message);
        } else {
            throw error;
        }
    } finally {
        dispatch(hideLoadingIndicator());
    }
};

export const setLiquidStakingProvider = async (type: EarnType) => {
    logger.log('uiActions/setLiquidStakingProvider');
    return await submitRequestToBackground<LiquidStakingData>('setLiquidStakingProvider', [type]);
};

export const getExchangeRate = async (amount: string) => {
    logger.log('uiActions/getExchangeRate');
    return await submitRequestToBackground<number>('getExchangeRate', [amount]);
};

export const getUnstakeExchangeRate = async (amount: string) => {
    logger.log('uiActions/getUnstakeExchangeRate');
    return await submitRequestToBackground<number>('getUnstakeExchangeRate', [amount]);
};

export const getWaitTime = async () => {
    logger.log('uiActions/getWaitTime');
    return await submitRequestToBackground<number>('getWaitTime', []);
};

export const getClaimRequests = async (earnType: EarnType, walletAddress: string) => {
    const provider = LiquidStakingProviders[earnType];

    if (!provider || !provider.getClaimRequests) {
        throw new Error('getClaimRequests not exists.');
    }

    switch (provider.claimRequestsFetchType) {
        case 'contract':
            logger.log('uiActions/getClaimRequests');
            return await submitRequestToBackground<LiquidStakingRequest[]>('getClaimRequests', [
                walletAddress,
            ]);

        case 'api':
            return await provider.getClaimRequests(walletAddress);

        default:
            return [];
    }
};

export const estimateStake = async (walletAddress: string, amount: bigint) => {
    logger.log('uiActions/estimateStake');
    return await submitRequestToBackground<string | null>('estimateStake', [
        walletAddress,
        amount.toString(),
    ]);
};

export const estimateRequestUnstake = async (walletAddress: string, amount: bigint) => {
    logger.log('uiActions/estimateRequestUnstake');
    return await submitRequestToBackground<string | null>('estimateRequestUnstake', [
        walletAddress,
        amount.toString(),
    ]);
};

export const estimateUnstake = async (
    walletAddress: string,
    requestIDs?: number[] | string,
    amount?: bigint,
) => {
    logger.log('uiActions/estimateUnstake');
    return await submitRequestToBackground<string | null>('estimateUnstake', [
        walletAddress,
        requestIDs,
        amount?.toString(),
    ]);
};

export const estimateCancelUnstakeRequest = async (requestId: string, walletAddress: string) => {
    logger.log('uiActions/estimateCancelUnstakeRequest');
    return await submitRequestToBackground<string | null>('estimateCancelUnstakeRequest', [
        requestId,
        walletAddress,
    ]);
};

export const stake =
    (walletAddress: string, amount: bigint, gasInfo: GasInfo, gasLimit: number) =>
    async (dispatch: Function) => {
        logger.log('uiActions/stake');
        dispatch(showLoadingIndicator());

        try {
            return await submitRequestToBackground<TransactionResponse | null>('stake', [
                walletAddress,
                amount.toString(),
                gasInfo,
                gasLimit,
            ]);
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const requestUnstake =
    (walletAddress: string, amount: bigint, gasInfo: GasInfo, gasLimit: number) =>
    async (dispatch: Function) => {
        logger.log('uiActions/requestUnstake');
        dispatch(showLoadingIndicator());

        try {
            return await submitRequestToBackground<TransactionResponse | null>('requestUnstake', [
                walletAddress,
                amount.toString(),
                gasInfo,
                gasLimit,
            ]);
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const unstake =
    (
        walletAddress: string,
        requestIDs: number[] | string | undefined,
        amount: bigint | undefined,
        gasInfo: GasInfo,
        gasLimit: number,
    ) =>
    async (dispatch: Function) => {
        logger.log('uiActions/unstake');
        dispatch(showLoadingIndicator());

        try {
            return await submitRequestToBackground<TransactionResponse | null>('unstake', [
                walletAddress,
                requestIDs,
                amount?.toString(),
                gasInfo,
                gasLimit,
            ]);
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const cancelUnstakeRequest =
    (requestId: string, walletAddress: string, gasInfo: GasInfo, gasLimit: number) =>
    async (dispatch: Function) => {
        logger.log('uiActions/cancelUnstakeRequest');
        dispatch(showLoadingIndicator());

        try {
            return await submitRequestToBackground<TransactionResponse | null>(
                'cancelUnstakeRequest',
                [requestId, walletAddress, gasInfo, gasLimit],
            );
        } catch (error: any) {
            if (error?.message) {
                throw new Error(error.message);
            } else {
                throw error;
            }
        } finally {
            dispatch(hideLoadingIndicator());
        }
    };

export const checkContract = async (accountAddress: string) => {
    logger.log('uiActions/checkContract');
    return await submitRequestToBackground<boolean>('checkContract', [accountAddress]);
};

export const getStakeCall = async (amount: bigint, walletAddress: string) => {
    logger.log('uiActions/getStakeCall');
    return await submitRequestToBackground<any>('getStakeCall', [amount.toString(), walletAddress]);
};

export const getRequestUnstakeCall = async (amount: bigint, walletAddress: string) => {
    logger.log('uiActions/getRequestUnstakeCall');
    return await submitRequestToBackground<any>('getRequestUnstakeCall', [
        amount.toString(),
        walletAddress,
    ]);
};

export const getUnstakeCall = async (
    amount: bigint,
    walletAddress: string,
    requestIDs?: number[] | string,
) => {
    logger.log('uiActions/getUnstakeCall');
    return await submitRequestToBackground<any>('getUnstakeCall', [
        amount.toString(),
        walletAddress,
        requestIDs,
    ]);
};

export const getCancelUnstakeRequestCall = async (requestId: string, walletAddress: string) => {
    logger.log('uiActions/getCancelUnstakeRequestCall');
    return await submitRequestToBackground<any>('getCancelUnstakeRequestCall', [
        requestId,
        walletAddress,
    ]);
};
