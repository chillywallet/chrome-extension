import { PermissionConstraint, PermissionSubjectEntry } from '@metamask/permission-controller';
import { CaveatTypes } from '../shared/constants/permissions';
import { ChainData } from '../shared/types/Chain';
import { ChillyAccount } from '../shared/types/Wallet';
import { getRpcUrlByNetwork } from '../shared/utils/rpc';
import { isEqualCaseInsensitive } from '../shared/utils/string';
import { getReduxStore } from './store';

/** Non-deleted internal accounts as an array. */
export function getAllAccounts(): ChillyAccount[] {
    const store = getReduxStore();
    const state = store?.getState();
    if (!state) {
        return [];
    }
    const accounts = state.globalState.internalAccounts?.accounts;
    return Object.values(accounts ?? {}).filter(acc => !acc.metadata?.deleted);
}

/** Accounts for a wallet (keyring), in keyring order. */
export function getAccountsByWalletId(walletId: string): ChillyAccount[] {
    const list = getAllAccounts();
    const store = getReduxStore();
    const keyrings = store?.getState().globalState.keyrings ?? [];
    const findKeyring = keyrings.find(keyring => keyring.id === walletId);
    if (!findKeyring) {
        return [];
    }
    const result: ChillyAccount[] = [];
    for (const address of findKeyring.accounts) {
        const item = list.find(acc => acc.address === address);
        if (item) {
            result.push(item);
        }
    }
    return result;
}

export function getAccountsFromSubject(subject: PermissionSubjectEntry<PermissionConstraint>) {
    return getAccountsFromPermission(getAccountsPermissionFromSubject(subject));
}

export function getAccountsPermissionFromSubject(
    subject: PermissionSubjectEntry<PermissionConstraint>,
) {
    return subject?.permissions?.eth_accounts || {};
}

export function getAccountsFromPermission(accountsPermission: PermissionConstraint) {
    const accountsCaveat = getAccountsCaveatFromPermission(accountsPermission);
    return accountsCaveat && Array.isArray(accountsCaveat.value) ? accountsCaveat.value : [];
}

export function getAccountsCaveatFromPermission(accountsPermission: PermissionConstraint) {
    return (
        Array.isArray(accountsPermission.caveats) &&
        accountsPermission.caveats.find(
            caveat => caveat.type === CaveatTypes.restrictReturnedAccounts,
        )
    );
}

export const getConnectedAccountsForTab = (tabOrigin?: string) => {
    if (!tabOrigin) {
        return [];
    }

    const store = getReduxStore();
    const subjects = store?.getState().globalState.subjects;
    const internalAccounts = store?.getState().globalState.internalAccounts;

    const accounts: ChillyAccount[] = [];

    if (internalAccounts && subjects?.[tabOrigin]) {
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
};

export const findWalletForAddress = (walletAddress: string) => {
    const store = getReduxStore();
    const wallets = store?.getState().globalState.internalWallets.wallets;
    const keyrings = store?.getState().globalState.keyrings;

    const findKeyring = keyrings?.find(keyring =>
        keyring.accounts.some(account => isEqualCaseInsensitive(account, walletAddress)),
    );

    if (findKeyring && wallets?.[findKeyring.id]) {
        return wallets[findKeyring.id];
    }

    return null;
};

/**
 * Get the effective RPC URL for the currently selected network in the UI.
 */
export const getRpcUrlOnUIScript = (network: ChainData): string => {
    const store = getReduxStore();
    const state = store?.getState();

    if (!state) {
        return '';
    }

    const preferences = state.globalState.preferences;

    const { rpcUrls, customNetworks } = {
        rpcUrls: preferences.rpcUrls ?? {},
        customNetworks: preferences.customNetworks ?? [],
    };

    return getRpcUrlByNetwork(network, {
        rpcUrls,
        customNetworks,
    });
};
