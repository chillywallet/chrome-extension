import type {
    ControllerGetStateAction,
    ControllerStateChangeEvent,
    RestrictedControllerMessenger,
} from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import { EthAccountType, EthKeyring, EthMethod } from '@metamask/keyring-api';
import { Mutex } from 'async-mutex';
import type { Draft } from 'immer';
import { Json } from 'json-rpc-engine';
import _ from 'lodash';
import { Hex } from 'viem';
import { PersonalMessageParams } from '../lib/message-manager/types';
import { getUUIDFromAddress } from '../lib/WalletUtils';
import { AccountMetadata, ChillyAccount, ChillyWallet, WalletStatus } from '../shared/types/Wallet';
import logger from '../shared/utils/logger';
import { isEqualCaseInsensitive } from '../shared/utils/string';
import type {
    KeyringControllerGetAccountsAction,
    KeyringControllerGetKeyringByWalletId,
    KeyringControllerGetKeyringForAccountAction,
    KeyringControllerGetKeyringsByTypeAction,
    KeyringControllerSignPersonalMessageAction,
    KeyringControllerState,
    KeyringControllerStateChangeEvent,
    KeyringObject,
} from './KeyringController';
import { KeyringTypes } from './KeyringController';
import type {
    PortfolioControllerGetPortfolioCoinsAction,
    PortfolioControllerNewAddressesEvent,
} from './PortfolioController';

const controllerName = 'AccountsController';

/**
 * Returns the name of the keyring type.
 *
 * @param keyringType - The type of the keyring.
 * @returns The name of the keyring type.
 */
export function keyringTypeToName(keyringType: string): string {
    switch (keyringType) {
        case KeyringTypes.simple: {
            return 'Account';
        }
        case KeyringTypes.hd: {
            return 'Account';
        }
        case KeyringTypes.ledger: {
            return 'Ledger';
        }
        case KeyringTypes.trezor: {
            return 'Trezor';
        }
        default: {
            throw new Error(`Unknown keyring ${keyringType}`);
        }
    }
}

/**
 * Base label for auto-generated **wallet** names (sidebar), per keyring type.
 * Ledger uses "Ledger Wallet" / "Ledger Wallet 2"; Trezor uses "Trezor Wallet" …; HD and simple use "Wallet 1", "Wallet 2".
 */
export function keyringTypeToDefaultWalletBaseName(keyringType: string): string {
    switch (keyringType) {
        case KeyringTypes.simple:
        case KeyringTypes.hd: {
            return 'Wallet';
        }
        case KeyringTypes.ledger: {
            return 'Ledger Wallet';
        }
        case KeyringTypes.trezor: {
            return 'Trezor Wallet';
        }
        default: {
            throw new Error(`Unknown keyring ${keyringType}`);
        }
    }
}

/** Auto-generated Ledger wallet names we recognize for collision checks (no persisted keyring field). */
function isLedgerAutoWalletName(name: string): boolean {
    const t = name.trim();
    return t === 'Ledger Wallet' || /^Ledger Wallet [0-9]+$/u.test(t);
}

/** Auto-generated Trezor wallet names we recognize for collision checks (no persisted keyring field). */
function isTrezorAutoWalletName(name: string): boolean {
    const t = name.trim();
    return t === 'Trezor Wallet' || /^Trezor Wallet [0-9]+$/u.test(t);
}

/** Auto-generated HD/simple wallet names: `Wallet 1`, `Wallet 2`, … */
function isWalletAutoName(name: string): boolean {
    return /^Wallet ([0-9]+)$/u.test(name.trim());
}

function deepCloneDraft(state: Draft<AccountsControllerState>) {
    return _.cloneDeep(state) as unknown as AccountsControllerState;
}

export type AccountsControllerState = {
    internalWallets: {
        wallets: Record<string, ChillyWallet>;
        selectedWallet: string; // id of the selected wallet
    };
    internalAccounts: {
        accounts: Record<string, ChillyAccount>;
        selectedAccount: string; // id of the selected account
    };
};

export type AccountsControllerGetStateAction = ControllerGetStateAction<
    typeof controllerName,
    //@ts-ignore
    AccountsControllerState
>;

export type AccountsControllerSetSelectedAccountAction = {
    type: `${typeof controllerName}:setSelectedAccount`;
    handler: AccountsController['setSelectedAccount'];
};

export type AccountsControllerSetSelectedWalletAction = {
    type: `${typeof controllerName}:setSelectedWallet`;
    handler: AccountsController['setSelectedWallet'];
};

export type AccountsControllerSetAccountNameAction = {
    type: `${typeof controllerName}:updateAccount`;
    handler: AccountsController['updateAccount'];
};

export type AccountsControllerListAccountsAction = {
    type: `${typeof controllerName}:listAccounts`;
    handler: AccountsController['listAccounts'];
};

export type AccountsControllerGetSelectedAccountAction = {
    type: `${typeof controllerName}:getSelectedAccount`;
    handler: AccountsController['getSelectedAccount'];
};

export type AccountsControllerGetAccountByAddressAction = {
    type: `${typeof controllerName}:getAccountByAddress`;
    handler: AccountsController['getAccountByAddress'];
};

export type AccountsControllerGetNextAvailableAccountNameAction = {
    type: `${typeof controllerName}:getNextAvailableAccountName`;
    handler: AccountsController['getNextAvailableAccountName'];
};

export type AccountsControllerGetAccountAction = {
    type: `${typeof controllerName}:getAccount`;
    handler: AccountsController['getAccount'];
};

export type AllowedActions =
    | KeyringControllerGetKeyringForAccountAction
    | KeyringControllerGetKeyringsByTypeAction
    | KeyringControllerGetAccountsAction
    | KeyringControllerGetKeyringByWalletId
    | KeyringControllerSignPersonalMessageAction
    | PortfolioControllerGetPortfolioCoinsAction;

export type AccountsControllerActions =
    | AccountsControllerGetStateAction
    | AccountsControllerSetSelectedAccountAction
    | AccountsControllerSetSelectedWalletAction
    | AccountsControllerListAccountsAction
    | AccountsControllerSetAccountNameAction
    | AccountsControllerGetAccountByAddressAction
    | AccountsControllerGetSelectedAccountAction
    | AccountsControllerGetNextAvailableAccountNameAction
    | AccountsControllerGetAccountAction;

export type AccountsControllerChangeEvent = ControllerStateChangeEvent<
    typeof controllerName,
    //@ts-ignore
    AccountsControllerState
>;

export type AccountsControllerSelectedAccountChangeEvent = {
    type: `${typeof controllerName}:selectedAccountChange`;
    payload: [ChillyAccount];
};

export type AccountsControllerSelectedWalletChangeEvent = {
    type: `${typeof controllerName}:selectedWalletChange`;
    payload: [ChillyWallet];
};

export type AllowedEvents =
    | KeyringControllerStateChangeEvent
    | PortfolioControllerNewAddressesEvent;

export type AccountsControllerEvents =
    | AccountsControllerChangeEvent
    | AccountsControllerSelectedWalletChangeEvent
    | AccountsControllerSelectedAccountChangeEvent;

export type AccountsControllerMessenger = RestrictedControllerMessenger<
    typeof controllerName,
    AccountsControllerActions | AllowedActions,
    AccountsControllerEvents | AllowedEvents,
    AllowedActions['type'],
    AllowedEvents['type']
>;

type AddressAndKeyringTypeObject = {
    address: string;
    type: string;
};

const accountsControllerMetadata = {
    internalWallets: {
        persist: true,
        anonymous: false,
    },
    internalAccounts: {
        persist: true,
        anonymous: false,
    },
};

const defaultState: AccountsControllerState = {
    internalWallets: {
        wallets: {},
        selectedWallet: '',
    },
    internalAccounts: {
        accounts: {},
        selectedAccount: '',
    },
};

/**
 * Controller that manages internal accounts.
 * The accounts controller is responsible for creating and managing internal accounts.
 * It also provides convenience methods for accessing and updating the internal accounts.
 * The accounts controller also listens for keyring state changes and updates the internal accounts accordingly.
 *
 */
export class AccountsController extends BaseController<
    typeof controllerName,
    //@ts-ignore
    AccountsControllerState,
    AccountsControllerMessenger
> {
    sendUpdate: Function;
    private readonly verifyAllMutex = new Mutex();
    /**
     * Constructor for AccountsController.
     *
     * @param options - The controller options.
     * @param options.messenger - The messenger object.
     * @param options.state - Initial state to set on this controller
     */
    constructor({
        messenger,
        state,
        sendUpdate,
    }: {
        messenger: AccountsControllerMessenger;
        state: AccountsControllerState;
        sendUpdate: Function;
    }) {
        super({
            messenger,
            name: controllerName,
            metadata: accountsControllerMetadata,
            state: {
                ...defaultState,
                ...state,
            },
        });

        this.sendUpdate = sendUpdate;
        this.messagingSystem.subscribe('KeyringController:stateChange', keyringState =>
            this.#handleOnKeyringStateChange(keyringState),
        );

        this.messagingSystem.subscribe('PortfolioController:newAddress', newAddress => {
            logger.log('🚀 New address', newAddress);

            // Wait briefly to ensure the wallet is fully added before triggering verification
            setTimeout(() => {
                this.verifyAllAccounts();
            }, 1000);
        });

        this.#registerMessageHandlers();
    }

    /**
     * Returns the internal account object for the given account ID, if it exists.
     *
     * @param accountId - The ID of the account to retrieve.
     * @returns The internal account object, or undefined if the account does not exist.
     */
    getAccount(accountId: string): ChillyAccount | undefined {
        return this.state.internalAccounts.accounts[accountId];
    }

    /**
     * Returns an array of all internal accounts.
     *
     * @returns An array of ChillyAccount objects.
     */
    listAccounts(): ChillyAccount[] {
        // Only return accounts that are not soft-deleted
        return Object.values(this.state.internalAccounts.accounts).filter(
            account => !account.metadata.deleted,
        );
    }

    /**
     * Returns an array of all internal accounts, including soft-deleted ones.
     * This is intended for internal/background logic only.
     */
    listAccountsIncludingDeleted(): ChillyAccount[] {
        return Object.values(this.state.internalAccounts.accounts);
    }

    /**
     * Returns an array of all internal accounts.
     *
     * @returns An array of ChillyAccount objects.
     */
    listWallets(): ChillyWallet[] {
        return Object.values(this.state.internalWallets.wallets);
    }

    /**
     * Returns the internal account object for the given account ID.
     *
     * @param accountId - The ID of the account to retrieve.
     * @returns The internal account object.
     * @throws An error if the account ID is not found.
     */
    getAccountExpect(accountId: string): ChillyAccount {
        // Edge case where the extension is setup but the srp is not yet created
        // certain ui elements will query the selected address before any accounts are created.
        if (!accountId) {
            return {
                id: '',
                address: '',
                smartAddress: '',
                options: {},
                methods: [],
                type: EthAccountType.Eoa,
                metadata: {
                    name: '',
                    keyring: {
                        type: '',
                    },
                    importTime: 0,
                },
            };
        }

        const account = this.getAccount(accountId);

        if (account === undefined) {
            throw new Error(`Account Id "${accountId}" not found`);
        }

        return account;
    }

    /**
     * Returns the internal wallet object for the given wallet ID.
     *
     * @param walletId - The ID of the account to retrieve.
     * @returns The internal wallet object.
     * @throws An error if the wallet ID is not found.
     */
    getWallet(walletId: string): ChillyWallet {
        const wallet = this.state.internalWallets.wallets[walletId];

        if (wallet === undefined) {
            throw new Error(`Wallet Id "${walletId}" not found`);
        }

        return wallet;
    }

    /**
     * Returns the selected internal account.
     *
     * @returns The selected internal account.
     */
    getSelectedAccount(): ChillyAccount {
        return this.getAccountExpect(this.state.internalAccounts.selectedAccount);
    }

    /**
     * Returns the account with the specified address.
     * ! This method will only return the first account that matches the address
     * @param address - The address of the account to retrieve.
     * @returns The account with the specified address, or undefined if not found.
     */
    getAccountByAddress(address: string): ChillyAccount | undefined {
        return this.listAccountsIncludingDeleted().find(account =>
            isEqualCaseInsensitive(account.address, address),
        );
    }

    /**
     * Returns the account with the specified address.
     * ! This method will only return the first account that matches the address
     * @param smartAddress - The smart address of the account to retrieve.
     * @returns The account with the specified address, or undefined if not found.
     */
    getAccountBySmartAddress(smartAddress: string): ChillyAccount | undefined {
        return this.listAccounts().find(account =>
            isEqualCaseInsensitive(account.smartAddress, smartAddress),
        );
    }

    /**
     * Returns the account with the specified address, including soft-deleted accounts.
     *
     * @param address - The address of the account to retrieve.
     * @returns The account with the specified address, or undefined if not found.
     */
    getAccountByAddressIncludingDeleted(address: string): ChillyAccount | undefined {
        return this.listAccountsIncludingDeleted().find(account =>
            isEqualCaseInsensitive(account.address, address),
        );
    }

    /**
     * Soft-delete an account by its address by marking metadata.deleted = true.
     * Also updates the selected account if necessary.
     *
     * @param address - The address of the account to soft-delete.
     */
    softDeleteAccountByAddress(address: string): void {
        const account = this.getAccountByAddressIncludingDeleted(address);

        if (!account) {
            return;
        }

        const accountId = account.id;

        this.update((currentState: Draft<AccountsControllerState>) => {
            const newState = deepCloneDraft(currentState);
            const target = newState.internalAccounts.accounts[accountId];

            if (target) {
                target.metadata = {
                    ...target.metadata,
                    deleted: true,
                };
            }

            return newState;
        });

        // If the deleted account is currently selected, move selection to another account
        if (this.state.internalAccounts.selectedAccount === accountId) {
            const [nextAccount] = this.listAccounts()
                .filter(acc => acc.id !== accountId)
                .sort((accountA, accountB) => {
                    // sort by lastSelected descending
                    return (
                        (accountB.metadata.lastSelected ?? 0) -
                        (accountA.metadata.lastSelected ?? 0)
                    );
                });

            if (nextAccount) {
                this.setSelectedAccount(nextAccount.id);
            } else {
                this.update((currentState: Draft<AccountsControllerState>) => {
                    currentState.internalAccounts.selectedAccount = '';
                });
            }
        }
    }

    /**
     * Restore (undelete) a previously soft-deleted account by address.
     * Resets deleted flag and updates import/lastSelected timestamps.
     *
     * @param address - The address of the account to restore.
     * @returns The restored account, or undefined if not found.
     */
    restoreDeletedAccountByAddress(address: string): ChillyAccount | undefined {
        const account = this.getAccountByAddressIncludingDeleted(address);

        if (!account || !account.metadata.deleted) {
            return account;
        }

        const accountId = account.id;

        this.update((currentState: Draft<AccountsControllerState>) => {
            const newState = deepCloneDraft(currentState);
            const target = newState.internalAccounts.accounts[accountId];

            if (target) {
                target.metadata = {
                    ...target.metadata,
                    deleted: false,
                    lastSelected: Date.now(),
                };
            }

            return newState;
        });

        return this.getAccount(accountId);
    }

    /**
     * Restore any soft-deleted accounts whose addresses appear in the list (e.g. Ledger/Trezor
     * re-import for indices already on the keyring).
     */
    restoreSoftDeletedAccountsAtAddresses(addresses: readonly string[]): void {
        for (const raw of addresses) {
            const trimmed = typeof raw === 'string' ? raw.trim() : '';
            if (!trimmed.startsWith('0x')) {
                continue;
            }

            const internalAccount = this.getAccountByAddressIncludingDeleted(trimmed);
            if (internalAccount?.metadata?.deleted) {
                this.restoreDeletedAccountByAddress(trimmed);
            }
        }
    }

    /**
     * Sets the selected account by its ID.
     *
     * @param accountId - The ID of the account to be selected.
     */
    setSelectedAccount(accountId: string): void {
        const account = this.getAccountExpect(accountId);

        if (account.metadata.deleted) {
            throw new Error(`${account.metadata.name} is deleted`);
        }

        this.update((currentState: Draft<AccountsControllerState>) => {
            currentState.internalAccounts.accounts[account.id].metadata.lastSelected = Date.now();
            currentState.internalAccounts.selectedAccount = account.id;
        });

        this.messagingSystem.publish('AccountsController:selectedAccountChange', account);
    }

    /**
     * Sets the selected wallet by its ID.
     *
     * @param walletId - The ID of the wallet to be selected.
     */
    async setSelectedWallet(walletId: string): Promise<void> {
        const wallet = this.getWallet(walletId);

        this.update((currentState: Draft<AccountsControllerState>) => {
            currentState.internalWallets.wallets[wallet.id].lastSelected = Date.now();
            currentState.internalWallets.selectedWallet = wallet.id;
        });

        const keyring = (await this.messagingSystem.call(
            'KeyringController:getKeyringByWalletId',
            walletId,
        )) as EthKeyring<Json> | undefined;

        if (!keyring) {
            throw new Error('No HD keyring found for walletId: ' + walletId);
        }

        this.messagingSystem.publish('AccountsController:selectedWalletChange', wallet);
        const accounts = await keyring.getAccounts();

        if (
            !accounts.every(_account =>
                isEqualCaseInsensitive(
                    _account,
                    this.getAccount(this.state.internalAccounts.selectedAccount)?.address,
                ),
            )
        ) {
            for (const account of accounts) {
                const findAccount = this.listAccounts().find(internalAccount =>
                    isEqualCaseInsensitive(internalAccount.address, account),
                );

                if (findAccount) {
                    this.setSelectedAccount(findAccount.id);
                    break;
                }
            }
        }
    }

    /**
     * Sets the name of the account with the given ID.
     *
     * @param accountId - The ID of the account to set the name and avatar for.
     * @param accountName - The new name for the account.
     * @param avatar - The new emoji for the account.
     * @param isSmartWallet - Is smart wallet or not.
     * @throws An error if an account with the same name already exists.
     */
    updateAccount(
        accountId: string,
        accountName: string,
        avatar: string,
        isSmartWallet: boolean,
    ): void {
        const account = this.getAccountExpect(accountId);

        if (
            this.listAccounts().find(
                internalAccount =>
                    internalAccount.metadata.name === accountName &&
                    internalAccount.id !== accountId,
            )
        ) {
            throw new Error('Account name already exists');
        }

        this.update((currentState: Draft<AccountsControllerState>) => {
            const avatarObj = isSmartWallet ? { smartAvatar: avatar } : { avatar };
            const internalAccount = {
                ...account,
                metadata: { ...account.metadata, ...avatarObj, name: accountName },
            };

            const newState = _.cloneDeep(currentState) as unknown as AccountsControllerState;
            newState.internalAccounts.accounts[accountId] = internalAccount;

            return newState;
        });
    }

    /**
     * Sets the name of the wallet with the given ID.
     *
     * @param walletId - The ID of the wallet to set the name for.
     * @param walletName - The new name for the wallet.
     * @throws An error if an wallet with the same name already exists.
     */
    updateWallet(walletId: string, accountName: string): void {
        const account = this.getWallet(walletId);

        if (
            this.listWallets().find(
                internalWallet =>
                    internalWallet.name === accountName && internalWallet.id !== walletId,
            )
        ) {
            throw new Error('Wallet name already exists');
        }

        this.update((currentState: Draft<AccountsControllerState>) => {
            const internalWallet = {
                ...account,
                name: accountName,
            };

            const newState = _.cloneDeep(currentState) as unknown as AccountsControllerState;
            newState.internalWallets.wallets[walletId] = internalWallet;

            return newState;
        });
    }

    /**
     * Sets the name of the account with the given ID.
     *
     * @param accountAddress - The wallet address of the account to set the name and avatar for.
     * @param accountName - The new name for the account.
     * @param avatar - The new emoji for the account.
     * @param isSmartWallet - Is smart wallet or not.
     * @throws An error if account not found by the given address.
     * @throws An error if an account with the same name already exists.
     */
    updateAccountByAddress(
        accountAddress: string,
        accountName: string,
        avatar: string,
        isSmartWallet: boolean,
    ): void {
        const account = this.getAccountByAddress(accountAddress);

        if (!account) {
            throw new Error('Account not found');
        }

        if (
            this.listAccounts().find(
                internalAccount =>
                    internalAccount.metadata.name === accountName &&
                    internalAccount.address !== accountAddress,
            )
        ) {
            throw new Error('Account name already exists');
        }

        this.update((currentState: Draft<AccountsControllerState>) => {
            const avatarObj = isSmartWallet ? { smartAvatar: avatar } : { avatar };
            const internalAccount = {
                ...account,
                metadata: { ...account.metadata, ...avatarObj, name: accountName },
            };

            const newState = _.cloneDeep(currentState) as unknown as AccountsControllerState;
            newState.internalAccounts.accounts[account.id] = internalAccount;

            return newState;
        });
    }

    /**
     * Generates an internal account.
     * @param address - The address of the account.
     * @param type - The type of the account.
     * @returns The generated internal account.
     */
    #generateInternalAccount(address: string, type: string): ChillyAccount {
        return {
            id: getUUIDFromAddress(address),
            address,
            options: {},
            methods: [
                EthMethod.PersonalSign,
                EthMethod.Sign,
                EthMethod.SignTransaction,
                EthMethod.SignTypedDataV1,
                EthMethod.SignTypedDataV3,
                EthMethod.SignTypedDataV4,
            ],
            type: EthAccountType.Eoa,
            metadata: {
                name: '',
                importTime: Date.now(),
                keyring: {
                    type,
                },
            },
        };
    }

    /**
     * Handles changes in the keyring state, specifically when new accounts are added or removed.
     *
     * @param keyringState - The new state of the keyring controller.
     */
    #handleOnKeyringStateChange(keyringState: KeyringControllerState): void {
        if (keyringState.isUnlocked && keyringState.keyrings.length > 0) {
            const updatedNormalKeyringAddresses: AddressAndKeyringTypeObject[] = [];
            const currentWallets = this.listWallets();

            for (const keyring of keyringState.keyrings) {
                updatedNormalKeyringAddresses.push(
                    ...keyring.accounts.map(address => {
                        return {
                            address,
                            type: keyring.type,
                        };
                    }),
                );
            }

            const { previousNormalInternalAccounts } = this.listAccountsIncludingDeleted().reduce(
                (accumulator, account) => {
                    accumulator.previousNormalInternalAccounts.push(account);
                    return accumulator;
                },
                {
                    previousNormalInternalAccounts: [] as ChillyAccount[],
                },
            );

            const addedWallets: KeyringObject[] = [];
            const deletedWallets: ChillyWallet[] = [];

            const addedAccounts: AddressAndKeyringTypeObject[] = [];
            const deletedAccounts: ChillyAccount[] = [];

            // finding new wallets
            for (const wallet of keyringState.keyrings) {
                if (!this.state.internalWallets.wallets[wallet.id]) {
                    addedWallets.push(wallet);
                }
            }

            // finding all the wallets that were deleted
            for (const wallet of currentWallets) {
                if (!keyringState.keyrings.find(keyring => keyring.id === wallet.id)) {
                    deletedWallets.push(wallet);
                }
            }

            // finding new accounts
            for (const account of updatedNormalKeyringAddresses) {
                if (!this.state.internalAccounts.accounts[getUUIDFromAddress(account.address)]) {
                    addedAccounts.push(account);
                }
            }

            // finding all the normal accounts that were deleted
            for (const account of previousNormalInternalAccounts) {
                if (
                    !updatedNormalKeyringAddresses.find(
                        ({ address }) => address.toLowerCase() === account.address.toLowerCase(),
                    )
                ) {
                    deletedAccounts.push(account);
                }
            }

            if (deletedWallets.length > 0) {
                for (const wallet of deletedWallets) {
                    this.#handleWalletRemoved(wallet.id);
                }
            }

            if (deletedAccounts.length > 0) {
                for (const account of deletedAccounts) {
                    this.#handleAccountRemoved(account.id);
                }
            }

            const changeSelectedAccount = addedWallets.length === 0;

            if (addedAccounts.length > 0) {
                for (const account of addedAccounts) {
                    this.#handleNewAccountAdded(account, changeSelectedAccount);
                }
            }

            if (addedWallets.length > 0) {
                for (const wallet of addedWallets) {
                    this.#handleNewWalletAdded(wallet);
                }
            }

            // handle if the selected wallet was deleted
            if (!this.state.internalWallets.wallets[this.state.internalWallets.selectedWallet]) {
                const [walletToSelect] = this.listWallets().sort((walletA, walletB) => {
                    // sort by lastSelected descending
                    return (walletB.lastSelected ?? 0) - (walletA.lastSelected ?? 0);
                });

                // if the walletToSelect is undefined, then there are no accounts
                // it mean the keyring was reinitialized.
                if (!walletToSelect) {
                    this.update((currentState: Draft<AccountsControllerState>) => {
                        currentState.internalWallets.selectedWallet = '';
                    });
                    return;
                }

                this.setSelectedWallet(walletToSelect.id);
            }
            // handle if the selected account was deleted
            else if (!this.getAccount(this.state.internalAccounts.selectedAccount)) {
                const [accountToSelect] = this.listAccounts().sort((accountA, accountB) => {
                    // sort by lastSelected descending
                    return (
                        (accountB.metadata.lastSelected ?? 0) -
                        (accountA.metadata.lastSelected ?? 0)
                    );
                });

                // if the accountToSelect is undefined, then there are no accounts
                // it mean the keyring was reinitialized.
                if (!accountToSelect) {
                    this.update((currentState: Draft<AccountsControllerState>) => {
                        currentState.internalAccounts.selectedAccount = '';
                    });
                    return;
                }

                this.setSelectedAccount(accountToSelect.id);
            }
        }
    }

    /**
     * Returns the list of accounts for a given keyring type.
     * @param keyringType - The type of keyring.
     * @returns The list of accounts associcated with this keyring type.
     */
    #getAccountsByKeyringType(keyringType: string) {
        return this.listAccounts().filter(internalAccount => {
            // We do consider `hd` and `simple` keyrings to be of same type. So we check those 2 types
            // to group those accounts together!
            if (keyringType === KeyringTypes.hd || keyringType === KeyringTypes.simple) {
                return (
                    internalAccount.metadata.keyring.type === KeyringTypes.hd ||
                    internalAccount.metadata.keyring.type === KeyringTypes.simple
                );
            }

            return internalAccount.metadata.keyring.type === keyringType;
        });
    }

    /**
     * Returns whether an account's keyring type matches the given keyring type.
     */
    #accountKeyringTypeMatches(account: ChillyAccount, keyringType: string): boolean {
        if (keyringType === KeyringTypes.hd || keyringType === KeyringTypes.simple) {
            return (
                account.metadata.keyring.type === KeyringTypes.hd ||
                account.metadata.keyring.type === KeyringTypes.simple
            );
        }
        return account.metadata.keyring.type === keyringType;
    }

    /**
     * Returns the next available account name for a given keyring type.
     * Prefers reusing a name from a soft-deleted account of the same keyring type if available.
     * Ensures the returned name is not used by any non-deleted account.
     *
     * @param keyringType - The type of keyring.
     * @returns A name that no existing (non-deleted) account has.
     */
    getNextAvailableAccountName(keyringType: string = KeyringTypes.hd): string {
        const keyringName = keyringTypeToName(keyringType);
        const namePattern = new RegExp(`^${keyringName} ([0-9]+)$`, 'u');

        const usedNames = new Set(this.listAccounts().map(account => account.metadata.name));

        const isNameAvailable = (name: string) => !usedNames.has(name);

        const deletedAccountsOfType = this.listAccountsIncludingDeleted().filter(
            account =>
                account.metadata.deleted && this.#accountKeyringTypeMatches(account, keyringType),
        );

        const deletedNamesByIndex = deletedAccountsOfType
            .map(account => {
                const match = namePattern.exec(account.metadata.name);
                return match
                    ? { name: account.metadata.name, index: parseInt(match[1], 10) }
                    : null;
            })
            .filter((item): item is { name: string; index: number } => item !== null)
            .sort((a, b) => a.index - b.index);

        for (const { name } of deletedNamesByIndex) {
            if (isNameAvailable(name)) {
                return name;
            }
        }

        let index = 1;
        let candidate = `${keyringName} ${index}`;
        while (!isNameAvailable(candidate)) {
            index += 1;
            candidate = `${keyringName} ${index}`;
        }
        return candidate;
    }

    /** First Ledger: "Ledger Wallet"; further: "Ledger Wallet 2", "Ledger Wallet 3", … */
    #getNextAvailableLedgerWalletName(): string {
        const groupWallets = this.listWallets().filter(w => isLedgerAutoWalletName(w.name));
        const usedOrdinals = new Set<number>();

        for (const w of groupWallets) {
            const t = w.name.trim();
            if (t === 'Ledger Wallet') {
                usedOrdinals.add(1);
            } else {
                const m = /^Ledger Wallet ([0-9]+)$/u.exec(t);
                if (m) {
                    usedOrdinals.add(parseInt(m[1], 10));
                }
            }
        }
        let i = 1;
        while (usedOrdinals.has(i)) {
            i += 1;
        }
        if (i === 1) {
            return 'Ledger Wallet';
        }
        return `Ledger Wallet ${i}`;
    }

    /** First Trezor: "Trezor Wallet"; further: "Trezor Wallet 2", … */
    #getNextAvailableTrezorWalletName(): string {
        const groupWallets = this.listWallets().filter(w => isTrezorAutoWalletName(w.name));
        const usedOrdinals = new Set<number>();

        for (const w of groupWallets) {
            const t = w.name.trim();
            if (t === 'Trezor Wallet') {
                usedOrdinals.add(1);
            } else {
                const m = /^Trezor Wallet ([0-9]+)$/u.exec(t);
                if (m) {
                    usedOrdinals.add(parseInt(m[1], 10));
                }
            }
        }
        let i = 1;
        while (usedOrdinals.has(i)) {
            i += 1;
        }
        if (i === 1) {
            return 'Trezor Wallet';
        }
        return `Trezor Wallet ${i}`;
    }

    /** "Wallet 1", "Wallet 2", … — only considers existing `Wallet N` default names (pattern match). */
    #getNextAvailableHdStyleWalletName(): string {
        const pattern = /^Wallet ([0-9]+)$/u;
        const groupWallets = this.listWallets().filter(w => isWalletAutoName(w.name));
        const lastIndex = groupWallets.reduce((max, wallet) => {
            const match = pattern.exec(wallet.name.trim());
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        const index = Math.max(groupWallets.length + 1, lastIndex + 1);
        return `Wallet ${index}`;
    }

    /**
     * Next default sidebar wallet name for the given keyring type.
     * @see keyringTypeToDefaultWalletBaseName
     */
    getNextAvailableWalletName(keyringType: string): string {
        if (keyringType === KeyringTypes.ledger) {
            return this.#getNextAvailableLedgerWalletName();
        }
        if (keyringType === KeyringTypes.trezor) {
            return this.#getNextAvailableTrezorWalletName();
        }
        if (keyringType === KeyringTypes.hd || keyringType === KeyringTypes.simple) {
            return this.#getNextAvailableHdStyleWalletName();
        }
        throw new Error(`Unknown keyring ${keyringType}`);
    }

    async verifyAllAccounts() {
        // Backend wallet verification has been removed.
    }

    /**
     * Handles the addition of a new account to the controller.
     * If the account is not a Snap Keyring account, generates an internal account for it and adds it to the controller.
     * If the account is a Snap Keyring account, retrieves the account from the keyring and adds it to the controller.
     * @param account - The address and keyring type object of the new account.
     */
    #handleNewAccountAdded(account: AddressAndKeyringTypeObject, changeSelectedAccount: boolean) {
        let newAccount: ChillyAccount = this.#generateInternalAccount(account.address, account.type);

        // Get next account name available for this given keyring
        const accountName = this.getNextAvailableAccountName(newAccount.metadata.keyring.type);

        this.update((currentState: Draft<AccountsControllerState>) => {
            // FIXME: deep clone of old state to get around Type instantiation is excessively deep and possibly infinite.
            const newState = deepCloneDraft(currentState);

            newState.internalAccounts.accounts[newAccount.id] = {
                ...newAccount,
                metadata: {
                    ...newAccount.metadata,
                    name: accountName,
                    importTime: Date.now(),
                    lastSelected: Date.now(),
                },
            };

            return newState;
        });

        if (changeSelectedAccount) {
            this.setSelectedAccount(newAccount.id);
        }
    }

    /**
     * Handles the addition of a new wallet to the controller.
     * @param wallet - The address and keyring type object of the new account.
     */
    #handleNewWalletAdded(wallet: KeyringObject) {
        let newWallet: ChillyWallet = {
            id: wallet.id,
            name: this.getNextAvailableWalletName(wallet.type),
            importTime: Date.now(),
        };

        this.update((currentState: Draft<AccountsControllerState>) => {
            const newState = deepCloneDraft(currentState);

            newState.internalWallets.wallets[newWallet.id] = newWallet;

            return newState;
        });

        this.setSelectedWallet(newWallet.id);
    }

    /**
     * Handles the removal of an account from the internal accounts list.
     * @param accountId - The ID of the account to be removed.
     */
    #handleAccountRemoved(accountId: string) {
        this.update((currentState: Draft<AccountsControllerState>) => {
            delete currentState.internalAccounts.accounts[accountId];
        });
    }

    /**
     * Handles the removal of an wallet from the internal wallets list.
     * @param walletId - The ID of the wallet to be removed.
     */
    #handleWalletRemoved(walletId: string) {
        this.update((currentState: Draft<AccountsControllerState>) => {
            delete currentState.internalWallets.wallets[walletId];
        });
    }

    /**
     * Registers message handlers for the AccountsController.
     * @private
     */
    #registerMessageHandlers() {
        this.messagingSystem.registerActionHandler(
            `${controllerName}:setSelectedAccount`,
            this.setSelectedAccount.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${controllerName}:setSelectedWallet`,
            this.setSelectedWallet.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${controllerName}:listAccounts`,
            this.listAccounts.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${controllerName}:updateAccount`,
            this.updateAccount.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${controllerName}:getSelectedAccount`,
            this.getSelectedAccount.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${controllerName}:getAccountByAddress`,
            this.getAccountByAddress.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${controllerName}:getNextAvailableAccountName`,
            this.getNextAvailableAccountName.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `AccountsController:getAccount`,
            this.getAccount.bind(this),
        );

        // Trigger verify all accounts
        // Expose via messenger from UI will call Background to invoke this
    }
}
