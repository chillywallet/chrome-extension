import { ApprovalType } from '@metamask/controller-utils';
import { JsonRpcProvider, parseEther } from 'ethers';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { DEFAULT_CHAIN, getCurrentChainByChainId } from '../lib/ChainsUtils';
import { CHAIN_CONFIG_ETHEREUM as CHAIN_ETHEREUM } from '../config/chains';
import { createRpcProvider } from '../lib/rpcProvider';
import { ConnectedSite } from '../shared/types/Connection';
import { Coin, GasType, ChillyAccount } from '../shared/types/Wallet';
import { getRpcUrlByNetwork } from '../shared/utils/rpc';
import { isEqualCaseInsensitive } from '../shared/utils/string';
import { getAccountsFromSubject } from './selectorUtils';
import { ReduxState } from './store';

export const useIsInitialized = () => {
    return useSelector((state: ReduxState) => state.globalState.isInitialized);
};

export const useIsUnlocked = () => {
    return useSelector((state: ReduxState) => state.globalState.isUnlocked);
};

export const usePreferences = () => {
    return useSelector((state: ReduxState) => state.globalState.preferences);
};

export const useActualTheme = () => {
    const { darkMode, darkModeSystem } = usePreferences();
    const isDarkMode = darkModeSystem
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : darkMode;
    return isDarkMode ? 'dark' : 'light';
};

export const useActiveTab = () => {
    return useSelector((state: ReduxState) => state.activeTab);
};

export const useIsShowLoading = () => {
    return useSelector((state: ReduxState) => state.uiState.isShowLoading);
};

export const useCompletedOnboarding = () => {
    return useSelector((state: ReduxState) => state.globalState.completedOnboarding);
};

export const useCurrentAccount = () => {
    const internalAccounts = useSelector((state: ReduxState) => state.globalState.internalAccounts);
    const selectedAccount =
        internalAccounts?.accounts && internalAccounts?.selectedAccount
            ? internalAccounts.accounts[internalAccounts.selectedAccount]
            : null;

    return selectedAccount;
};

export const useCurrentAccountByAddress = (address: string) => {
    const internalAccounts = useSelector(
        (state: ReduxState) => state.globalState.internalAccounts,
    )?.accounts;

    const accounts = Object.values(internalAccounts ?? {});
    const account = accounts.find(account => isEqualCaseInsensitive(account.address, address));
    const smartAccount = accounts.find(account =>
        isEqualCaseInsensitive(account.smartAddress, address),
    );
    const isSmartWallet = smartAccount !== undefined;
    return { account: isSmartWallet ? smartAccount : account, isSmartWallet };
};

export const useCurrentWallet = () => {
    const internalWallets = useSelector((state: ReduxState) => state.globalState.internalWallets);
    const selectedWallet =
        internalWallets?.wallets && internalWallets?.selectedWallet
            ? internalWallets.wallets[internalWallets.selectedWallet]
            : null;

    return selectedWallet;
};

export const useSmartAddress = () => {
    const selectedAccount = useCurrentAccount();
    return selectedAccount?.smartAddress;
};

export const useCurrentAddress = (isAAWallet: boolean) => {
    const currentAccount = useCurrentAccount();
    return isAAWallet ? currentAccount?.smartAddress : currentAccount?.address;
};

export const useOnboardingStep = () => {
    return useSelector((state: ReduxState) => state.globalState.onboardingStep);
};

export const useAccounts = (walletId?: string) => {
    const accounts = useSelector(
        (state: ReduxState) => state.globalState.internalAccounts.accounts,
    );
    const keyrings = useSelector((state: ReduxState) => state.globalState.keyrings);
    const list = Object.values(accounts ?? {}).filter(acc => !acc?.metadata?.deleted);

    if (!walletId) {
        return list;
    }

    const result: ChillyAccount[] = [];
    const keyring = keyrings?.find(k => k.id === walletId);
    if (!keyring) {
        return result;
    }
    keyring.accounts.forEach(addr => {
        const item = list.find(_acc => _acc.address === addr);
        if (item) {
            result.push(item);
        }
    });
    return result;
};

export const useWallets = () => {
    const wallets = useSelector((state: ReduxState) => state.globalState.internalWallets.wallets);
    return Object.values(wallets);
};

export const useKeyrings = () => {
    return useSelector((state: ReduxState) => state.globalState.keyrings);
};

export const useContacts = () => {
    return useSelector((state: ReduxState) => state.globalState.contacts);
};

export const useRecentContacts = () => {
    return useSelector((state: ReduxState) => state.globalState.recentContacts);
};

export const useSelectedNetwork = () => {
    const rawNetwork = useSelector((state: ReduxState) => state.globalState.selectedNetwork);
    return getCurrentChainByChainId(rawNetwork.chain_id);
};

export const useDefaultProvider = () => {
    const preferences = usePreferences();
    const provider = useMemo(() => {
        const rpcUrl = getRpcUrlByNetwork(DEFAULT_CHAIN, {
            rpcUrls: preferences.rpcUrls,
            customNetworks: preferences.customNetworks,
        });

        return createRpcProvider(rpcUrl || DEFAULT_CHAIN.rpcUrl || '', DEFAULT_CHAIN.chain_id);
    }, [preferences.rpcUrls, preferences.customNetworks]);

    return provider;
};

export const useEthProvider = () => {
    const preferences = usePreferences();
    const provider = useMemo(() => {
        const rpcUrl = getRpcUrlByNetwork(CHAIN_ETHEREUM, {
            rpcUrls: preferences.rpcUrls,
            customNetworks: preferences.customNetworks,
        });

        return createRpcProvider(rpcUrl || CHAIN_ETHEREUM.rpcUrl || '', CHAIN_ETHEREUM.chain_id);
    }, [preferences.rpcUrls, preferences.customNetworks]);

    return provider;
};

const initPortfolioCoins: Coin[] = [];

export const usePortfolioCoins = (walletAddress?: string) => {
    const selectedNetwork = useSelectedNetwork();
    const portfolioCoins = useSelector((state: ReduxState) => state.portfolio?.portfolioCoins);

    if (walletAddress) {
        const result = portfolioCoins[walletAddress.toLowerCase()];

        if (result && result[selectedNetwork?.platform_id]) {
            return result[selectedNetwork?.platform_id] ?? initPortfolioCoins;
        } else {
            return initPortfolioCoins;
        }
    }
    return initPortfolioCoins;
};

export const useCoinByTokenAddress = (tokenAddress: string, walletAddress: string) => {
    const portfolioCoins = usePortfolioCoins(walletAddress);
    const coin = portfolioCoins.find(_coin =>
        isEqualCaseInsensitive(_coin.token_address, tokenAddress),
    );

    return coin;
};

const initCoinPrice: number = 0;

export const useNativeCoinPrice = () => {
    const selectedNetwork = useSelectedNetwork();
    const nativeCoinPrices =
        useSelector((state: ReduxState) => state.globalState.nativeCoinPrices) ?? {};

    if (nativeCoinPrices[selectedNetwork?.platform_id]) {
        return nativeCoinPrices[selectedNetwork?.platform_id] ?? initCoinPrice;
    } else {
        return initCoinPrice;
    }
};

export const usePortfolioNfts = (walletAddress?: string) => {
    const selectedNetwork = useSelectedNetwork();
    const nfts = useSelector((state: ReduxState) => state.portfolio?.nfts || {});

    if (!walletAddress || !selectedNetwork?.platform_id) {
        return [];
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const addressData = nfts[normalizedAddress];

    if (addressData && typeof addressData === 'object') {
        return addressData[selectedNetwork.platform_id] || [];
    }

    return [];
};

export const usePortfolioTransactions = (walletAddress?: string) => {
    const selectedNetwork = useSelectedNetwork();
    const transactions = useSelector((state: ReduxState) => state.portfolio?.transactions || {});

    if (!walletAddress || !selectedNetwork?.platform_id) {
        return [];
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const addressData = transactions[normalizedAddress];

    if (addressData && typeof addressData === 'object') {
        return addressData[selectedNetwork.platform_id] || [];
    }

    return [];
};

export const usePendingTransactions = (walletAddress?: string) => {
    const selectedNetwork = useSelectedNetwork();
    const pendingTransactions = useSelector(
        (state: ReduxState) => state.globalState.pendingTransactions,
    );
    if (walletAddress) {
        const result = pendingTransactions[walletAddress.toLowerCase()];
        if (result && result[selectedNetwork?.platform_id]) {
            return result[selectedNetwork?.platform_id] ?? [];
        } else {
            return [];
        }
    }
    return [];
};

export const useCustomGas = (chainId: number) => {
    const customGas = useSelector((state: ReduxState) => state.globalState.customGas);
    return customGas[chainId] ? customGas[chainId] : undefined;
};

export const useGasType = (chainId: number) => {
    const gasType = useSelector((state: ReduxState) => state.globalState.gasType);
    return gasType && gasType[chainId] ? gasType[chainId] : GasType.Medium;
};

export const useGasOptionsData = (chainId: number) => {
    const gasOptionsData = useSelector((state: ReduxState) => state.globalState.gasOptionsData);
    return gasOptionsData[chainId] ? gasOptionsData[chainId] : undefined;
};

export const useGasInfo = (chainId: number) => {
    const customGas = useCustomGas(chainId);
    const gasType = useGasType(chainId);
    const gasOptionsData = useGasOptionsData(chainId);
    return { gasType, customGas, gasOptionsData };
};

export const usePendingApprovals = () => {
    const pendingApprovals = useSelector((state: ReduxState) => state.globalState.pendingApprovals);
    return Object.values(pendingApprovals);
};

export const useApprovalFlows = () => {
    return useSelector((state: ReduxState) => state.globalState.approvalFlows);
};

export function usePermissionsRequests() {
    const pendingApprovals = usePendingApprovals();
    const permissionRequests = pendingApprovals
        .filter(({ type }) => type === ApprovalType.WalletRequestPermissions)
        .map(({ requestData }) => requestData);
    return permissionRequests;
}

export function useFirstPermissionRequest() {
    const requests = usePermissionsRequests();
    return requests && requests[0] ? requests[0] : null;
}

export function useSubjectMetadataByOrigin(origin: string) {
    const subjectMetadata = useSelector((state: ReduxState) => state.globalState.subjectMetadata);
    return subjectMetadata[origin] ? subjectMetadata[origin] : null;
}

export function useConnectedSubjectsForSelectedAddress(isSmartWallet?: boolean) {
    const currentAccount = useCurrentAccount();
    const subjects = useSelector((state: ReduxState) => state.globalState.subjects);
    const subjectMetadata = useSelector((state: ReduxState) => state.globalState.subjectMetadata);

    if (!currentAccount) {
        return [];
    }

    const walletAddress = isSmartWallet
        ? currentAccount.smartAddress ?? ''
        : currentAccount.address;

    const connectedSubjects: ConnectedSite[] = [];
    Object.entries(subjects).forEach(([subjectKey, subjectValue]) => {
        const exposedAccounts = getAccountsFromSubject(subjectValue);
        if (!exposedAccounts.includes(walletAddress)) {
            return;
        }

        const { extensionId, name, iconUrl } = subjectMetadata[subjectKey] || {};

        connectedSubjects.push({
            extensionId,
            origin: subjectKey,
            name,
            iconUrl,
        });
    });

    return connectedSubjects;
}

export function useConnectedAccountsForTab(tabOrigin?: string) {
    const subjects = useSelector((state: ReduxState) => state.globalState.subjects);
    const internalAccounts = useSelector((state: ReduxState) => state.globalState.internalAccounts);

    if (!tabOrigin) {
        return [];
    }

    const accounts: ChillyAccount[] = [];

    if (subjects[tabOrigin]) {
        const exposedAccounts = getAccountsFromSubject(subjects[tabOrigin]) as string[];
        const chillyAccounts = Object.values(internalAccounts.accounts).filter(
            acc => !acc.metadata?.deleted,
        );

        exposedAccounts.forEach(account => {
            const acc = chillyAccounts.find(acc => isEqualCaseInsensitive(acc.address, account));

            if (acc) {
                accounts.push(acc);
            }
        });
    }

    return accounts;
}

export const useUnapprovedMessages = () => {
    const unapprovedTypedMessages = useSelector(
        (state: ReduxState) => state.globalState.unapprovedTypedMessages,
    );
    const unapprovedPersonalMsgs = useSelector(
        (state: ReduxState) => state.globalState.unapprovedPersonalMsgs,
    );

    return { ...unapprovedTypedMessages, ...unapprovedPersonalMsgs };
};

export function useFirstUnapprovedMessage() {
    const msgs = useUnapprovedMessages();
    const list = Object.values(msgs);
    return list.length ? list[0] : null;
}

export function usePlatform() {
    return useSelector((state: ReduxState) => state.platform);
}

export const useIsTestnet = () => {
    const selectedNetwork = useSelectedNetwork();
    return selectedNetwork.testnet ?? false;
};

export const useRemoteFavoriteLinks = () => {
    return useSelector((state: ReduxState) => state.remoteFavoriteLinks);
};

export const useNativeCoinBalance = (walletAddress?: string) => {
    const currentChain = useSelectedNetwork();
    const nativeTokenBalance =
        useSelector((state: ReduxState) => state.globalState.nativeTokenBalance) ?? {};

    if (
        walletAddress &&
        nativeTokenBalance[walletAddress] &&
        nativeTokenBalance[walletAddress][currentChain.chain_id]
    ) {
        const _balance = nativeTokenBalance[walletAddress][currentChain.chain_id];

        // Check if the balance is a number
        if (typeof _balance === 'number') {
            const oldBalance = parseEther(String(_balance));
            return oldBalance;
        }

        return BigInt(_balance);
    }

    return BigInt(0);
};

