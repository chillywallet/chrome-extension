import { ActionConstraint, ControllerMessenger, EventConstraint } from '@metamask/base-controller';
import { ApprovalType } from '@metamask/controller-utils';
import { JsonRpcEngine, JsonRpcMiddleware } from '@metamask/json-rpc-engine';
import { createEngineStream } from '@metamask/json-rpc-middleware-stream';
import {
    CaveatSpecificationConstraint,
    PermissionController,
    PermissionSpecificationConstraint,
    PermissionsRequest,
    PermissionsRequestNotFoundError,
    SubjectMetadataController,
    SubjectType,
} from '@metamask/permission-controller';
import { wordlist } from '@metamask/scure-bip39/dist/wordlists/english';
import { Json, JsonRpcParams, NonEmptyArray } from '@metamask/utils';
import { Mutex } from 'await-semaphore';
import { EthereumRpcError, errorCodes as rpcErrorCodes } from 'eth-rpc-errors';
import { JsonRpcProvider } from 'ethers';
import EventEmitter from 'events';
import PortDuplexStream from 'extension-port-stream';
import { debounce } from 'lodash';
import { nanoid } from 'nanoid';
import { finished, pipeline } from 'readable-stream';
import browser from 'webextension-polyfill';
import ComposableObservableStore from '../lib/ComposableObservableStore';
import { encryptorFactory } from '../lib/EncryptorFactory';
import ExtensionPlatform from '../lib/ExtensionPlatform';
import LocalStore from '../lib/LocalStore';
import createRPCHandler from '../lib/RPCHandler';
import { serializeBigInt } from '../lib/bigintSerializer';
import createDupeReqFilterMiddleware from '../lib/createDupeReqFilterMiddleware';
import createChillyMiddleware from '../lib/createChillyMiddleware';
import createLoggerMiddleware from '../lib/createLoggerMiddleware';
import { createMethodMiddleware } from '../lib/createMethodMiddleware';
import createOriginMiddleware from '../lib/createOriginMiddleware';
import createProviderMiddleware from '../lib/createProviderMiddleware';
import createSelectedNetworkMiddleware from '../lib/createSelectedNetworkMiddleware';
import createTabIdMiddleware from '../lib/createTabIdMiddleware';
import { ledgerOffscreenKeyringBuilder } from '../lib/ledger/ledgerKeyringBuilder';
import {
    CaveatMutatorFactories,
    NOTIFICATION_NAMES,
    getCaveatSpecifications,
    getChangedAccounts,
    getPermissionBackgroundApiMethods,
    getPermissionSpecifications,
    getPermittedAccountsByOrigin,
    unrestrictedMethods,
} from '../lib/permissions';
import { isStreamWritable, setupMultiplex } from '../lib/stream-utils';
import { AddTransactionOptions } from '../lib/transactions/utils';
import { trezorOffscreenKeyringBuilder } from '../lib/trezor/trezorKeyringBuilder';
import { toHex } from '../lib/web3';
import { EnvironmentType, ORIGIN_CHILLY } from '../shared/constants/app';
import { CaveatTypes, RestrictedMethods } from '../shared/constants/permissions';
import { CONTROLLER, EXTERNAL_PROVIDER, INTERNAL_PROVIDER } from '../shared/constants/stream';
import { ChainData } from '../shared/types/Chain';
import { TransactionMeta, TransactionParams } from '../shared/types/Transaction';
import { checkForLastErrorAndLog, isManifestV3 } from '../shared/utils/browser-runtime-utils';
import logger from '../shared/utils/logger';
import { getRpcUrlByNetwork } from '../shared/utils/rpc';
import { getAccountsFromSubject } from '../store/selectorUtils';
import { AccountsController } from './AccountController';
import AppStateController, { AppStateControllerState } from './AppStateController';
import {
    AcceptOptions,
    ApprovalController,
    ApprovalRequestNotFoundError,
} from './ApprovalController';
import ContactsController, { ContactsControllerState } from './ContactsController';
import GasController, { GasControllerState } from './GasController';
import { KeyringController } from './KeyringController';
import LiquidStakingController from './LiquidStakingController';
import NetworkController, { NetworkControllerState } from './NetworkController';
import OnboardingController, { OnboardingControllerState } from './OnboardingController';
import PortfolioController, { PortfolioControllerState } from './PortfolioController';
import PreferencesController from './PreferencesController';
import { SignatureController } from './SignatureController';
import TransactionController, { TransactionControllerState } from './TransactionController';

type Props = {
    initState: any;
    localStore: LocalStore;
    showUserConfirmation: () => void;
    platform: ExtensionPlatform;
};

//@ts-ignore
export default class AppController extends EventEmitter {
    _isClientOpen: boolean = false;
    startedUISync: boolean = false;
    connections: Record<string, Record<string, { engine: JsonRpcEngine }>> = {};
    activeControllerConnections: number = 0;
    extension: ExtensionPlatform;
    sendUpdate: Function;

    store: ComposableObservableStore;
    memStore: ComposableObservableStore;
    localStoreApiWrapper: LocalStore;

    controllerMessenger: ControllerMessenger<ActionConstraint, EventConstraint>;
    accountsController: AccountsController;
    keyringController: KeyringController;
    preferencesController: PreferencesController;
    onboardingController: OnboardingController;
    contactsController: ContactsController;
    portfolioController: PortfolioController;
    networkController: NetworkController;
    transactionController: TransactionController;
    liquidStakingController: LiquidStakingController;
    gasController: GasController;
    permissionController: PermissionController<
        PermissionSpecificationConstraint,
        CaveatSpecificationConstraint
    >;
    approvalController: ApprovalController;
    subjectMetadataController: SubjectMetadataController;
    appStateController: AppStateController;
    signatureController: SignatureController;

    createVaultMutex: Mutex;

    provider: JsonRpcProvider;
    currentChain: ChainData;

    constructor(props: Props) {
        super();
        const { initState, localStore, platform } = props;
        this.controllerMessenger = new ControllerMessenger();
        this.localStoreApiWrapper = localStore;
        this.extension = platform;
        this.createVaultMutex = new Mutex();

        this.sendUpdate = debounce(this.privateSendUpdate.bind(this), 200);

        this.store = new ComposableObservableStore({
            state: initState,
            controllerMessenger: this.controllerMessenger,
            persist: true,
        });

        this.keyringController = this.getKeyringController(initState.KeyringController);
        this.accountsController = this.getAccountsController(initState.AccountsController);
        this.onboardingController = this.getOnboardingControler(initState.OnboardingController);
        this.contactsController = this.getContactsController(initState.ContactsController);
        this.networkController = this.getNetworkController(initState.NetworkController);
        this.portfolioController = this.getPortfolioController(initState.PortfolioController);
        this.appStateController = this.getAppStateController(initState.AppStateController);
        this.preferencesController = this.getPreferencesController(initState.PreferencesController);

        this.provider = this.networkController.initializeProvider();
        this.currentChain = this.networkController.getSelectedNetwork();

        this.transactionController = this.getTransactionController(initState.TransactionController);
        this.liquidStakingController = this.getLiquidStakingController();
        this.gasController = this.getGasController(initState.GasController);
        this.approvalController = this.getApprovalController(props.showUserConfirmation);
        this.permissionController = this.getPermissionController(initState.PermissionController);
        this.subjectMetadataController = this.getSubjectMetadataController(
            initState.SubjectMetadataController,
        );
        this.signatureController = this.getSignatureController();

        //@ts-ignore
        this.controllerMessenger.subscribe('KeyringController:unlock', () => this._onUnlock());
        //@ts-ignore
        this.controllerMessenger.subscribe('NetworkController:networkChange', () =>
            this._onNetworkChange(),
        );
        //@ts-ignore
        this.controllerMessenger.subscribe('KeyringController:lock', () => this._onLock());
        //@ts-ignore
        this.controllerMessenger.subscribe(
            'PermissionController:stateChange',
            (currentValue: any, previousValue: any) => {
                const changedAccounts = getChangedAccounts(currentValue, previousValue);

                for (const [origin, accounts] of changedAccounts.entries()) {
                    this._notifyAccountsChange(origin, accounts);
                }
            },
            getPermittedAccountsByOrigin,
        );

        //@ts-ignore
        this.controllerMessenger.subscribe('NetworkController:networkChange', chain => {
            this._notifyChainChange();
            this.currentChain = chain;
        });

        //@ts-ignore
        this.controllerMessenger.subscribe('AccountsController:selectedAccountChange', () => {
            this._onSelectedAccountChange();
        });

        const storeConfig = {
            AccountsController: this.accountsController,
            KeyringController: this.keyringController,
            PreferencesController: this.preferencesController.store,
            OnboardingController: this.onboardingController.store,
            ContactsController: this.contactsController.store,
            NetworkController: this.networkController.store,
            TransactionController: this.transactionController,
            GasController: this.gasController.store,
            PortfolioController: this.portfolioController.store,
            AppStateController: this.appStateController.store,
            PermissionController: this.permissionController,
            ApprovalController: this.approvalController,
            SubjectMetadataController: this.subjectMetadataController,
            SignatureController: this.signatureController,
        };

        this.store.updateStructure(storeConfig);

        this.memStore = new ComposableObservableStore({
            config: storeConfig,
            controllerMessenger: this.controllerMessenger,
        });

        this.startUISync();
    }

    startUISync() {
        // Message startUISync is used to start syncing state with UI
        this.emit('startUISync');
        this.startedUISync = true;
        this.memStore.subscribe(this.sendUpdate.bind(this));
    }

    getSignatureController() {
        return new SignatureController({
            messenger: this.controllerMessenger.getRestricted({
                name: 'SignatureController',
                allowedActions: [
                    //@ts-ignore
                    `ApprovalController:addRequest`,
                    //@ts-ignore
                    `KeyringController:signMessage`,
                    //@ts-ignore
                    `KeyringController:signPersonalMessage`,
                    //@ts-ignore
                    `KeyringController:signTypedMessage`,
                ],
                allowedEvents: [],
            }),
            getCurrentChainId: () =>
                toHex(this.networkController.getSelectedNetwork().chain_id) as `0x${string}`,
            getAccountBySmartAddress: this.accountsController.getAccountBySmartAddress.bind(
                this.accountsController,
            ),
            getPrivateKey: this.keyringController.getPrivateKeyInternally.bind(
                this.keyringController,
            ),
            getSelectedNetwork: () => {
                return this.networkController.getSelectedNetwork();
            },
        });
    }

    getSubjectMetadataController(initState: any) {
        return new SubjectMetadataController({
            messenger: this.controllerMessenger.getRestricted({
                name: 'SubjectMetadataController',
                allowedEvents: [],
                allowedActions: [
                    //@ts-ignore
                    `${this.permissionController.name}:hasPermissions`,
                ],
            }),
            state: initState,
            subjectCacheLimit: 100,
        });
    }

    getApprovalController(showUserConfirmation: () => void) {
        const messenger = this.controllerMessenger.getRestricted({
            name: 'ApprovalController',
            allowedActions: [],
            allowedEvents: [],
        });
        return new ApprovalController({
            //@ts-ignore
            messenger,
            showApprovalRequest: showUserConfirmation,
            typesExcludedFromRateLimiting: [
                ApprovalType.EthSign,
                ApprovalType.PersonalSign,
                ApprovalType.EthSignTypedData,
                ApprovalType.Transaction,
                ApprovalType.WatchAsset,
                ApprovalType.EthGetEncryptionPublicKey,
                ApprovalType.EthDecrypt,
            ],
        });
    }

    getPermissionController(initState: any) {
        const messenger = this.controllerMessenger.getRestricted({
            name: 'PermissionController',
            allowedActions: [
                //@ts-ignore
                `ApprovalController:addRequest`,
                //@ts-ignore
                `ApprovalController:hasRequest`,
                //@ts-ignore
                `ApprovalController:acceptRequest`,
                //@ts-ignore
                `ApprovalController:rejectRequest`,
                //@ts-ignore
                `SubjectMetadataController:getSubjectMetadata`,
            ],
        });
        return new PermissionController({
            messenger,
            state: initState,
            caveatSpecifications: getCaveatSpecifications({
                getInternalAccounts: this.accountsController.listAccounts.bind(
                    this.accountsController,
                ),
            }),
            //@ts-ignore
            permissionSpecifications: {
                ...getPermissionSpecifications({
                    getInternalAccounts: this.accountsController.listAccounts.bind(
                        this.accountsController,
                    ),
                }),
            },
            unrestrictedMethods,
        });
    }

    getKeyringController(initState: any) {
        //@ts-ignore
        const keyringControllerMessenger = this.controllerMessenger.getRestricted({
            name: 'KeyringController',
        });

        //@ts-ignore
        return new KeyringController({
            cacheEncryptionKey: true,
            keyringBuilders: [ledgerOffscreenKeyringBuilder, trezorOffscreenKeyringBuilder],
            state: initState,
            encryptor: encryptorFactory(600_000),
            messenger: keyringControllerMessenger,
        });
    }

    getTransactionController(initState: TransactionControllerState) {
        const messenger = this.controllerMessenger.getRestricted({
            name: 'TransactionController',
            allowedActions: [
                //@ts-ignore
                `ApprovalController:addRequest`,
                //@ts-ignore
                `AccountsController:getSelectedAccount`,
                //@ts-ignore
                `AccountsController:getAccountByAddress`,
                //@ts-ignore
                `KeyringController:signAuthorization`,
                //@ts-ignore
                `KeyringController:signTypedMessageUsingViem`,
                //@ts-ignore
                `KeyringController:sendTransactionUsingViem`,
                //@ts-ignore
                `KeyringController:getKeyringForAccount`,
                //@ts-ignore
                `NetworkController:getCurrentProvider`,
            ],
            allowedEvents: [],
        });
        return new TransactionController({
            state: initState,
            messenger,
            //@ts-ignore
            sign: this.keyringController.signTransaction.bind(this.keyringController),
            getPrivateKey: this.keyringController.getPrivateKeyInternally.bind(
                this.keyringController,
            ),
            getPermittedAccounts: this.getPermittedAccounts.bind(this),
            getSelectedNetwork: () => {
                return this.networkController.getSelectedNetwork();
            },
            getProviderByChainId: (chainId: number) => {
                return this.networkController.getProviderByChainId(chainId);
            },
            getAccountBySmartAddress: this.accountsController.getAccountBySmartAddress.bind(
                this.accountsController,
            ),
        });
    }

    getLiquidStakingController() {
        const messenger = this.controllerMessenger.getRestricted({
            name: 'LiquidStakingController',
            allowedActions: [
                //@ts-ignore
                'NetworkController:getCurrentProvider',
            ],
            allowedEvents: [],
        });
        return new LiquidStakingController({
            state: {},
            messenger,
            getPrivateKey: this.keyringController.getPrivateKeyInternally.bind(
                this.keyringController,
            ),
            getProviderByChainId: (chainId: number) => {
                return this.networkController.getProviderByChainId(chainId);
            },
        });
    }

    getGasController(initState: GasControllerState) {
        const messenger = this.controllerMessenger.getRestricted({
            name: 'GasController',
            allowedActions: [],
            allowedEvents: [],
        });
        return new GasController({
            state: initState,
            messenger,
            getProviderForNetwork: this.networkController.getProviderForNetwork.bind(
                this.networkController,
            ),
        });
    }

    getNetworkController(initState: NetworkControllerState) {
        const messenger = this.controllerMessenger.getRestricted({
            name: 'NetworkController',
            allowedActions: [],
            allowedEvents: [],
        });
        return new NetworkController({
            state: initState,
            messenger,
            getRpcConfig: () => this.getRpcConfigForControllers(),
        });
    }

    getContactsController(initState: ContactsControllerState) {
        return new ContactsController({ state: initState });
    }

    getPortfolioController(initState: PortfolioControllerState) {
        return new PortfolioController({
            state: initState,
            getProviderByPlatformId: this.networkController.getProviderByPlatformId.bind(
                this.networkController,
            ),
            messagingSystem: this.controllerMessenger.getRestricted({
                name: 'PortfolioController',
                allowedActions: [],
                allowedEvents: [],
            }),
        });
    }

    getOnboardingControler(initState: OnboardingControllerState) {
        return new OnboardingController({ state: initState });
    }

    getAppStateController(initState: AppStateControllerState) {
        return new AppStateController({
            state: initState,
            isUnlocked: this.isUnlocked.bind(this),
            messenger: this.controllerMessenger.getRestricted({
                name: 'AppStateController',
                allowedActions: [
                    //@ts-ignore
                    `ApprovalController:addRequest`,
                    //@ts-ignore
                    `ApprovalController:acceptRequest`,
                ],
                allowedEvents: [],
            }),
        });
    }

    getPreferencesController(initState: any) {
        const preferencesMessenger = this.controllerMessenger.getRestricted({
            name: 'PreferencesController',
            allowedActions: [],
            allowedEvents: [],
        });

        return new PreferencesController({
            state: initState,
            messenger: preferencesMessenger,
            getSelectedNetwork: this.networkController.getSelectedNetwork.bind(
                this.networkController,
            ),
            setSelectedNetwork: this.networkController.setSelectedNetwork.bind(
                this.networkController,
            ),
        });
    }

    getAccountsController(initState: any) {
        const accountsControllerMessenger = this.controllerMessenger.getRestricted({
            name: 'AccountsController',
            allowedEvents: [
                //@ts-ignore
                'KeyringController:accountRemoved',
                //@ts-ignore
                'KeyringController:stateChange',
                //@ts-ignore
                'AccountsController:selectedAccountChange',
                //@ts-ignore
                'PortfolioController:newAddress',
            ],
            allowedActions: [
                //@ts-ignore
                'AccountsController:setCurrentAccount',
                //@ts-ignore
                'AccountsController:updateAccount',
                //@ts-ignore
                'AccountsController:listAccounts',
                //@ts-ignore
                'AccountsController:getSelectedAccount',
                //@ts-ignore
                'AccountsController:getAccountByAddress',
                //@ts-ignore
                `KeyringController:getKeyringByWalletId`,
                //@ts-ignore
                `KeyringController:signPersonalMessage`,
                //@ts-ignore
                `PortfolioController:getPortfolioCoins`,
            ],
        });

        return new AccountsController({
            messenger: accountsControllerMessenger,
            sendUpdate: this.sendUpdate,
            state: initState,
        });
    }

    /**
     * True when `tabId` is an injectable (`<all_urls>`) tab active in the last-focused window.
     * Matches querying without `"tabs"` permission (see Background.tsx tab broadcast).
     */
    async isSenderActiveBrowserTab(tabId: unknown, origin: string): Promise<boolean> {
        if (origin === ORIGIN_CHILLY) {
            return true;
        }
        if (typeof tabId !== 'number') {
            return false;
        }
        const tabs = await browser.tabs
            .query({
                active: true,
                lastFocusedWindow: true,
                url: '<all_urls>',
            })
            .then(result => {
                checkForLastErrorAndLog();
                return result;
            })
            .catch(() => {
                checkForLastErrorAndLog();
                return [];
            });

        return tabs.some(t => t.id === tabId);
    }

    /**
     * A method for creating a provider that is safely restricted for the requesting subject.
     *
     * @param {object} options - Provider engine options
     * @param {string} options.origin - The origin of the sender
     * @param {MessageSender | SnapSender} options.sender - The sender object.
     * @param {string} options.subjectType - The type of the sender subject.
     * @param {tabId} [options.tabId] - The tab ID of the sender - if the sender is within a tab
     */
    setupProviderEngine({
        origin,
        subjectType,
        sender,
        tabId,
    }: {
        origin: string;
        subjectType: SubjectType;
        sender: any;
        tabId: any;
    }) {
        // setup json rpc engine stack
        const engine = new JsonRpcEngine();

        // append origin to each request
        engine.push(createOriginMiddleware({ origin }));

        // append selectedNetworkClientId to each request
        engine.push(createSelectedNetworkMiddleware(this.networkController));

        if (isManifestV3) {
            engine.push(createDupeReqFilterMiddleware());
        }

        // append tabId to each request if it exists
        if (tabId) {
            engine.push(createTabIdMiddleware({ tabId }));
        }

        // logging
        engine.push(createLoggerMiddleware({ origin }));

        // Unrestricted/permissionless RPC method implementations
        engine.push(
            createMethodMiddleware({
                origin,

                // send-metadata
                subjectType,
                addSubjectMetadata: this.subjectMetadataController.addSubjectMetadata.bind(
                    this.subjectMetadataController,
                ),

                // eth-accounts, request-accounts
                getAccounts: this.getPermittedAccounts.bind(this, origin),

                // get-provider-state
                getProviderState: this.getProviderState.bind(this),

                // request-accounts
                getUnlockPromise: this.appStateController.getUnlockPromise.bind(
                    this.appStateController,
                ),
                hasPermission: this.permissionController.hasPermission.bind(
                    this.permissionController,
                    origin,
                ),
                requestAccountsPermission: this.permissionController.requestPermissions.bind(
                    this.permissionController,
                    { origin },
                    { eth_accounts: {} },
                ),

                requestUserApproval: this.approvalController.addAndShowApprovalRequest.bind(
                    this.approvalController,
                ),
                isSenderActiveBrowserTab: (tabId: unknown, origin: string) =>
                    this.isSenderActiveBrowserTab(tabId, origin),
                getCurrentChain: () => this.networkController.getSelectedNetwork(),
                setSelectedNetwork: this.networkController.setSelectedNetwork.bind(
                    this.networkController,
                ),

                setCustomNetworks: this.preferencesController.setCustomNetworks.bind(
                    this.preferencesController,
                ),

                getPermissionsForOrigin: this.permissionController.getPermissions.bind(
                    this.permissionController,
                    origin,
                ),

                hasPermissions: this.permissionController.hasPermissions.bind(
                    this.permissionController,
                    origin,
                ),

                requestPermissionsForOrigin: this.permissionController.requestPermissions.bind(
                    this.permissionController,
                    { origin },
                ),
                revokePermissionsForOrigin: (permissionKeys: NonEmptyArray<string>) => {
                    try {
                        this.permissionController.revokePermissions({
                            [origin]: permissionKeys,
                        });
                    } catch (e) {
                        // we dont want to handle errors here because
                        // the revokePermissions api method should just
                        // return `null` if the permissions were not
                        // successfully revoked or if the permissions
                        // for the origin do not exist
                        logger.log(e);
                    }
                },

                getCurrentRpcUrl: () => {
                    const selectedNetwork = this.networkController.getSelectedNetwork();
                    const { rpcUrls, customNetworks } = this.getRpcConfigForControllers();
                    return getRpcUrlByNetwork(selectedNetwork, {
                        rpcUrls,
                        customNetworks,
                    });
                },
                executeWalletSendCalls: this.transactionController.executeWalletSendCalls.bind(
                    this.transactionController,
                ),
                getCallBatchStatus: this.transactionController.getWalletSendCallsStatus.bind(
                    this.transactionController,
                ),
                hasCallBatch: this.transactionController.hasWalletSendCallsBatch.bind(
                    this.transactionController,
                ),
            }),
        );

        if (subjectType !== SubjectType.Internal) {
            engine.push(
                //@ts-ignore
                this.permissionController.createPermissionMiddleware({
                    origin,
                }),
            );
        }

        engine.push(
            createChillyMiddleware({
                version: '1.0.0',
                getAccounts: async req => {
                    // @ts-ignore
                    const origin: string = req.origin;

                    if (origin === ORIGIN_CHILLY) {
                        const accounts = [];
                        const selectedAccount = this.accountsController.getSelectedAccount();

                        if (selectedAccount.address) {
                            accounts.push(selectedAccount.address);
                        }

                        if (selectedAccount.smartAddress) {
                            accounts.push(selectedAccount.smartAddress);
                        }

                        return accounts;
                    } else if (this.isUnlocked()) {
                        return await this.getPermittedAccounts(origin);
                    }

                    return [];
                },
                //@ts-ignore
                processTransaction: (transactionParams, dappRequest) =>
                    this.processTransaction(transactionParams, dappRequest),

                //@ts-ignore
                processTypedMessage: this.signatureController.newUnsignedTypedMessage.bind(
                    this.signatureController,
                ),
                //@ts-ignore
                processTypedMessageV3: this.signatureController.newUnsignedTypedMessage.bind(
                    this.signatureController,
                ),
                //@ts-ignore
                processTypedMessageV4: this.signatureController.newUnsignedTypedMessage.bind(
                    this.signatureController,
                ),
                //@ts-ignore
                processPersonalMessage: this.signatureController.newUnsignedPersonalMessage.bind(
                    this.signatureController,
                ),

                getUnlockPromise: this.appStateController.getUnlockPromise.bind(
                    this.appStateController,
                ),
            }) as JsonRpcMiddleware<JsonRpcParams, Json>,
        );

        engine.push(createProviderMiddleware(() => this.networkController.getCurrentProvider()));

        return engine;
    }

    /**
     * A method for serving our ethereum provider over a given stream.
     *
     * @param {*} outStream - The stream to provide over.
     * @param {MessageSender | SnapSender} sender - The sender of the messages on this stream
     * @param {SubjectType} subjectType - The type of the sender, i.e. subject.
     */
    setupProviderConnection(outStream: PortDuplexStream, sender: any, subjectType: SubjectType) {
        let origin: string;
        if (subjectType === SubjectType.Internal) {
            origin = ORIGIN_CHILLY;
        } else {
            origin = new URL(sender.url).origin;
        }

        if (sender.id && sender.id !== browser.runtime.id) {
            this.subjectMetadataController.addSubjectMetadata({
                origin,
                extensionId: sender.id,
                subjectType: SubjectType.Extension,
            });
        }

        let tabId;
        if (sender.tab && sender.tab.id) {
            tabId = sender.tab.id;
        }

        const engine = this.setupProviderEngine({
            origin,
            sender,
            subjectType,
            tabId,
        });

        // setup connection
        const providerStream = createEngineStream({ engine });

        const connectionId = this.addConnection(origin, { engine });

        pipeline(outStream, providerStream, outStream, (err: any) => {
            // handle any middleware cleanup
            engine.destroy();
            connectionId && this.removeConnection(origin, connectionId);

            if (err && !err.message?.match('Premature close')) {
                logger.error(err);
            }
        });
    }

    /**
     * Used to create a multiplexed stream for connecting to an untrusted context
     * like a Dapp or other extension.
     *
     * @param options - Options bag.
     * @param {ReadableStream} options.connectionStream - The Duplex stream to connect to.
     * @param {MessageSender | SnapSender} options.sender - The sender of the messages on this stream.
     * @param {string} [options.subjectType] - The type of the sender, i.e. subject.
     */
    setupUntrustedCommunication({
        connectionStream,
        sender,
        subjectType,
    }: {
        connectionStream: PortDuplexStream;
        sender: any;
        subjectType?: SubjectType;
    }) {
        let _subjectType;

        if (subjectType) {
            _subjectType = subjectType;
        } else if (sender.id && sender.id !== browser.runtime.id) {
            _subjectType = SubjectType.Extension;
        } else {
            _subjectType = SubjectType.Website;
        }

        // setup multiplexing
        const mux = setupMultiplex(connectionStream);

        // messages between inpage and background
        this.setupProviderConnection(mux.createStream(EXTERNAL_PROVIDER), sender, _subjectType);
    }

    /**
     * Used to create a multiplexed stream for connecting to a trusted context,
     * like our own user interfaces, which have the provider APIs, but also
     * receive the exported API from this controller, which includes trusted
     * functions, like the ability to approve transactions or sign messages.
     *
     * @param {*} connectionStream - The duplex stream to connect to.
     * @param {MessageSender} sender - The sender of the messages on this stream
     */
    setupTrustedCommunication(connectionStream: PortDuplexStream, sender: any) {
        // setup multiplexing
        const mux = setupMultiplex(connectionStream);
        // connect features
        this.setupControllerConnection(mux.createStream(CONTROLLER));
        this.setupProviderConnection(
            mux.createStream(INTERNAL_PROVIDER),
            sender,
            SubjectType.Internal,
        );
    }

    /**
     * A method for providing our API over a stream using JSON-RPC.
     *
     * @param {*} outStream - The stream to provide our API over.
     */
    setupControllerConnection(outStream: any) {
        const api = this.getApi();

        // report new active controller connection
        this.activeControllerConnections += 1;
        this.emit('controllerConnectionChanged', this.activeControllerConnections);

        // set up postStream transport
        outStream.on(
            'data',
            createRPCHandler(api, outStream, this.store, this.localStoreApiWrapper),
        );

        const handleUpdate = (update: any) => {
            if (!isStreamWritable(outStream)) {
                return;
            }

            // Serialize bigint values in update before sending notification
            const serializedUpdate = serializeBigInt(update);

            // send notification to client-side
            outStream.write({
                jsonrpc: '2.0',
                method: 'sendUpdate',
                params: [serializedUpdate],
            });
        };
        this.on('update', handleUpdate);

        const startUISync = () => {
            if (!isStreamWritable(outStream)) {
                return;
            }

            // send notification to client-side
            outStream.write({
                jsonrpc: '2.0',
                method: 'startUISync',
            });
        };

        if (this.startedUISync) {
            startUISync();
        } else {
            this.once('startUISync', startUISync);
        }

        const outstreamEndHandler = () => {
            if (!outStream.mmFinished) {
                this.activeControllerConnections -= 1;
                this.emit('controllerConnectionChanged', this.activeControllerConnections);
                outStream.mmFinished = true;
                this.removeListener('update', handleUpdate);
            }
        };

        // The presence of both of the below handlers may be redundant.
        // After upgrading metamask/object-multiples to v2.0.0, which included
        // an upgrade of readable-streams from v2 to v3, we saw that the
        // `outStream.on('end'` handler was almost never being called. This seems to
        // related to how v3 handles errors vs how v2 handles errors; there
        // are "premature close" errors in both cases, although in the case
        // of v2 they don't prevent `outStream.on('end'` from being called.
        // At the time that this comment was committed, it was known that we
        // need to investigate and resolve the underlying error, however,
        // for expediency, we are not addressing them at this time. Instead, we
        // can observe that `readableStream.finished` preserves the same
        // functionality as we had when we relied on readable-stream v2. Meanwhile,
        // the `outStream.on('end')` handler was observed to have been called at least once.
        // In an abundance of caution to prevent against unexpected future behavioral changes in
        // streams implementations, we redundantly use multiple paths to attach the same event handler.
        // The outstreamEndHandler therefore needs to be idempotent, which introduces the `mmFinished` property.
        outStream.mmFinished = false;
        finished(outStream, outstreamEndHandler);
        outStream.once('close', outstreamEndHandler);
        outStream.once('end', outstreamEndHandler);
    }

    /**
     * Returns an Object containing API Callback Functions.
     * These functions are the interface for the UI.
     * The API object can be transmitted over a stream via JSON-RPC.
     *
     * @returns {object} Object containing API functions.
     */
    getApi() {
        return {
            getState: this.getState.bind(this),

            // primary keyring management
            addNewAccount: this.addNewAccount.bind(this),
            addNewWallet: this.addNewWallet.bind(this),
            getSeedPhrase: this.getSeedPhrase.bind(this),
            removeAccount: this.removeAccount.bind(this),
            removeWallet: this.removeWallet.bind(this),

            // vault management
            submitPassword: this.submitPassword.bind(this),
            verifyPassword: this.verifyPassword.bind(this),

            // AccountsController
            updateAccount: this.accountsController.updateAccountByAddress.bind(
                this.accountsController,
            ),
            updateWallet: this.accountsController.updateWallet.bind(this.accountsController),
            setSelectedAccount: this.accountsController.setSelectedAccount.bind(
                this.accountsController,
            ),
            setSelectedWallet: this.accountsController.setSelectedWallet.bind(
                this.accountsController,
            ),
            getNextAvailableAccountName: this.accountsController.getNextAvailableAccountName.bind(
                this.accountsController,
            ),

            // KeyringController
            setLocked: this.setLocked.bind(this),
            createNewVaultAndKeychain: this.createNewVaultAndKeychain.bind(this),
            createNewVaultAndRestore: this.createNewVaultAndRestore.bind(this),
            createNewVaultAndRestoreWithPrivateKey:
                this.createNewVaultAndRestoreWithPrivateKey.bind(this),
            addNewWalletWithPrivateKey: this.addNewWalletWithPrivateKey.bind(this),
            clearLedgerHardwarePreviewSession: this.clearLedgerHardwarePreviewSession.bind(this),
            getLedgerHardwareAddressPage: this.getLedgerHardwareAddressPage.bind(this),
            importLedgerHardwareAccounts: this.importLedgerHardwareAccounts.bind(this),
            clearTrezorHardwarePreviewSession: this.clearTrezorHardwarePreviewSession.bind(this),
            getTrezorHardwareAddressPage: this.getTrezorHardwareAddressPage.bind(this),
            importTrezorHardwareAccounts: this.importTrezorHardwareAccounts.bind(this),
            exportAccount: this.keyringController.exportAccount.bind(this.keyringController),

            // OnboardingController
            completeOnboarding: this.completeOnboarding.bind(this),
            setOnboardingStep: this.onboardingController.setOnboardingStep.bind(
                this.onboardingController,
            ),

            // ContactsController
            setContacts: this.contactsController.setContacts.bind(this.contactsController),
            setRecentContacts: this.contactsController.setRecentContacts.bind(
                this.contactsController,
            ),

            // PortfolioController
            setNativeCoinPrice: this.portfolioController.setNativeCoinPrice.bind(
                this.portfolioController,
            ),
            setPortfolioCoins: this.portfolioController.setPortfolioCoins.bind(
                this.portfolioController,
            ),
            getCurrentPortfolioCoins: this.portfolioController.getCurrentPortfolioCoins.bind(
                this.portfolioController,
            ),
            getCoinByTokenAddress: this.portfolioController.getCoinByTokenAddress.bind(
                this.portfolioController,
            ),
            updatePortfolioCoins: this.portfolioController.updatePortfolioCoins.bind(
                this.portfolioController,
            ),
            setCoinPrices: this.portfolioController.setCoinPrices.bind(this.portfolioController),
            getCurrentCoinPrices: this.portfolioController.getCurrentCoinPrices.bind(
                this.portfolioController,
            ),
            setPendingTransactions: this.portfolioController.setPendingTransactions.bind(
                this.portfolioController,
            ),
            addPendingTransaction: this.portfolioController.addPendingTransaction.bind(
                this.portfolioController,
            ),
            updatePendingTransactionStatus:
                this.portfolioController.updatePendingTransactionStatus.bind(
                    this.portfolioController,
                ),
            updatePendingTransaction: this.portfolioController.updatePendingTransaction.bind(
                this.portfolioController,
            ),
            removePendingTransactions: this.portfolioController.removePendingTransactions.bind(
                this.portfolioController,
            ),
            removeCompletedTransactions: this.portfolioController.removeCompletedTransactions.bind(
                this.portfolioController,
            ),
            setCachingCoins: this.portfolioController.setCachingCoins.bind(
                this.portfolioController,
            ),
            setUnknownCoins: this.portfolioController.setUnknownCoins.bind(
                this.portfolioController,
            ),

            // NetworkController
            setSelectedNetwork: this.networkController.setSelectedNetwork.bind(
                this.networkController,
            ),

            // GasController
            setGasOptionsData: this.gasController.setGasOptionsData.bind(this.gasController),
            loadGasOptions: this.gasController.loadGasOptions.bind(this.gasController),

            // TransactionController
            approveAllowance: this.transactionController.approveAllowance.bind(
                this.transactionController,
            ),
            checkAllowance: this.transactionController.checkAllowance.bind(
                this.transactionController,
            ),
            estimateGasAllowance: this.transactionController.estimateGasAllowance.bind(
                this.transactionController,
            ),
            estimateGasLimit: this.transactionController.estimateGasLimit.bind(
                this.transactionController,
            ),
            estimateGas: this.transactionController.estimateGas.bind(this.transactionController),
            estimateWalletSendCallsGas: this.transactionController.estimateWalletSendCallsGas.bind(
                this.transactionController,
            ),
            getTokenBalance: this.transactionController.getTokenBalance.bind(
                this.transactionController,
            ),
            getNativeTokenBalance: this.transactionController.getNativeTokenBalance.bind(
                this.transactionController,
            ),
            newSendTransaction: this.transactionController.newSendTransaction.bind(
                this.transactionController,
            ),
            sendTransaction: this.transactionController.sendTransaction.bind(
                this.transactionController,
            ),
            speedUpTransaction: this.transactionController.speedUpTransaction.bind(
                this.transactionController,
            ),
            cancelTransaction: this.transactionController.cancelTransaction.bind(
                this.transactionController,
            ),
            ensToWalletAdress: this.transactionController.ensToWalletAdress.bind(
                this.transactionController,
            ),
            getTransaction: this.transactionController.getTransaction.bind(
                this.transactionController,
            ),
            checkContract: this.transactionController.checkContract.bind(
                this.transactionController,
            ),

            // LiquidStakingController
            setLiquidStakingProvider: this.liquidStakingController.setLiquidStakingProvider.bind(
                this.liquidStakingController,
            ),
            getExchangeRate: this.liquidStakingController.getExchangeRate.bind(
                this.liquidStakingController,
            ),
            getUnstakeExchangeRate: this.liquidStakingController.getUnstakeExchangeRate.bind(
                this.liquidStakingController,
            ),
            getWaitTime: this.liquidStakingController.getWaitTime.bind(
                this.liquidStakingController,
            ),
            getStakeCall: this.liquidStakingController.getStakeCall.bind(
                this.liquidStakingController,
            ),
            getRequestUnstakeCall: this.liquidStakingController.getRequestUnstakeCall.bind(
                this.liquidStakingController,
            ),
            getUnstakeCall: this.liquidStakingController.getUnstakeCall.bind(
                this.liquidStakingController,
            ),
            getCancelUnstakeRequestCall:
                this.liquidStakingController.getCancelUnstakeRequestCall.bind(
                    this.liquidStakingController,
                ),
            getClaimRequests: this.liquidStakingController.getClaimRequests.bind(
                this.liquidStakingController,
            ),
            estimateStake: this.liquidStakingController.estimateStake.bind(
                this.liquidStakingController,
            ),
            estimateRequestUnstake: this.liquidStakingController.estimateRequestUnstake.bind(
                this.liquidStakingController,
            ),
            estimateUnstake: this.liquidStakingController.estimateUnstake.bind(
                this.liquidStakingController,
            ),
            estimateCancelUnstakeRequest:
                this.liquidStakingController.estimateCancelUnstakeRequest.bind(
                    this.liquidStakingController,
                ),
            stake: this.liquidStakingController.stake.bind(this.liquidStakingController),
            requestUnstake: this.liquidStakingController.requestUnstake.bind(
                this.liquidStakingController,
            ),
            unstake: this.liquidStakingController.unstake.bind(this.liquidStakingController),
            cancelUnstakeRequest: this.liquidStakingController.cancelUnstakeRequest.bind(
                this.liquidStakingController,
            ),

            // PreferencesController
            setPreference: this.preferencesController.setPreference.bind(
                this.preferencesController,
            ),
            setPreferences: this.preferencesController.setPreferences.bind(
                this.preferencesController,
            ),
            setApiKey: this.preferencesController.setApiKey.bind(this.preferencesController),
            setChainDataProvider: this.preferencesController.setChainDataProvider.bind(
                this.preferencesController,
            ),

            // GasController
            setCustomGas: this.gasController.setCustomGas.bind(this.gasController),
            setGasType: this.gasController.setGasType.bind(this.gasController),

            // ApprovalController
            approvePermissionsRequest: this.acceptPermissionsRequest,
            rejectPermissionsRequest: this.rejectPermissionsRequest,
            removePermissionsFor: this.removePermissionsFor,
            ...getPermissionBackgroundApiMethods(this.permissionController),
            resolvePendingApproval: this.resolvePendingApproval,
            rejectPendingApproval: this.rejectPendingApproval,

            // PermissionController
            notifyPermittedAccountsChanged: this._onSelectedAccountChange.bind(this),
        };
    }

    /**
     * The state of the various controllers, made available to the UI
     *
     * @returns {object} status
     */
    getState() {
        const { vault } = this.keyringController.state;
        const isInitialized = Boolean(vault);

        const flatState = this.memStore.getFlatState() as any;

        // The vault should not be exposed to the UI
        delete flatState.vault;
        delete flatState.encryptionKey;
        delete flatState.encryptionSalt;
        delete flatState.decimalsData;
        delete flatState.balanceData;
        delete flatState.portfolioCoins;
        delete flatState.coinPrices;

        const preferences = { ...(flatState?.preferences ?? {}) };
        delete preferences?.moonPayCurrencies;
        delete preferences?.moonPayCurrenciesTimestamp;
        flatState.preferences = preferences;

        return {
            isInitialized,
            ...flatState,
        };
    }

    /**
     * Converts a BIP-39 mnemonic stored as indices of words in the English wordlist to a buffer of Unicode code points.
     *
     * @param {Uint8Array} wordlistIndices - Indices to specific words in the BIP-39 English wordlist.
     * @returns {Buffer} The BIP-39 mnemonic formed from the words in the English wordlist, encoded as a list of Unicode code points.
     */
    _convertEnglishWordlistIndicesToCodepoints(wordlistIndices: Uint8Array) {
        return Buffer.from(
            Array.from(new Uint16Array(wordlistIndices.buffer))
                .map(i => wordlist[i])
                .join(' '),
        );
    }

    /**
     * Encodes a BIP-39 mnemonic as the indices of words in the English BIP-39 wordlist.
     *
     * @param {Buffer} mnemonic - The BIP-39 mnemonic.
     * @returns {Buffer} The Unicode code points for the seed phrase formed from the words in the wordlist.
     */
    _convertMnemonicToWordlistIndices(mnemonic: Buffer) {
        const indices = mnemonic
            .toString()
            .split(' ')
            .map(word => wordlist.indexOf(word));
        return new Uint8Array(new Uint16Array(indices).buffer);
    }

    async addNewWallet(seed?: Uint8Array) {
        return this._convertEnglishWordlistIndicesToCodepoints(
            await this.keyringController.addNewWallet(seed),
        );
    }

    async addNewWalletWithPrivateKey(privateKey: string) {
        return await this.keyringController.addNewWalletWithPrivateKey(privateKey);
    }

    async clearLedgerHardwarePreviewSession(): Promise<void> {
        return this.keyringController.clearLedgerHardwarePreviewSession();
    }

    async getLedgerHardwareAddressPage(
        direction: 'first' | 'next' | 'prev',
        ledgerWalletId?: string | null,
    ) {
        return this.keyringController.getLedgerHardwareAddressPage(direction, ledgerWalletId);
    }

    async importLedgerHardwareAccounts(
        indices: number[],
        ledgerWalletId?: string | null,
        vaultPassword?: string | null,
        addressesKnownFromUi?: string[] | null,
    ) {
        const hadVault = Boolean(this.keyringController.state.vault);
        const trimmedVaultPw =
            typeof vaultPassword === 'string' && vaultPassword.trim() !== ''
                ? vaultPassword.trim()
                : undefined;

        const runImport = async () => {
            const newAddresses = await this.keyringController.importLedgerHardwareAccounts(
                indices,
                ledgerWalletId,
                vaultPassword,
            );
            if (addressesKnownFromUi?.length) {
                this.accountsController.restoreSoftDeletedAccountsAtAddresses(addressesKnownFromUi);
            }
            return newAddresses;
        };

        if (
            !hadVault &&
            trimmedVaultPw &&
            (ledgerWalletId === undefined || ledgerWalletId === null)
        ) {
            const releaseLock = await this.createVaultMutex.acquire();
            try {
                const addresses = await runImport();
                this.portfolioController.clearState();
                return addresses;
            } finally {
                releaseLock();
            }
        }

        return runImport();
    }

    async clearTrezorHardwarePreviewSession(): Promise<void> {
        return this.keyringController.clearTrezorHardwarePreviewSession();
    }

    async getTrezorHardwareAddressPage(
        direction: 'first' | 'next' | 'prev',
        trezorWalletId?: string | null,
    ) {
        return this.keyringController.getTrezorHardwareAddressPage(direction, trezorWalletId);
    }

    async importTrezorHardwareAccounts(
        indices: number[],
        trezorWalletId?: string | null,
        vaultPassword?: string | null,
        addressesKnownFromUi?: string[] | null,
    ) {
        const hadVault = Boolean(this.keyringController.state.vault);
        const trimmedVaultPw =
            typeof vaultPassword === 'string' && vaultPassword.trim() !== ''
                ? vaultPassword.trim()
                : undefined;

        const runImport = async () => {
            const newAddresses = await this.keyringController.importTrezorHardwareAccounts(
                indices,
                trezorWalletId,
                vaultPassword,
            );
            if (addressesKnownFromUi?.length) {
                this.accountsController.restoreSoftDeletedAccountsAtAddresses(addressesKnownFromUi);
            }
            return newAddresses;
        };

        if (
            !hadVault &&
            trimmedVaultPw &&
            (trezorWalletId === undefined || trezorWalletId === null)
        ) {
            const releaseLock = await this.createVaultMutex.acquire();
            try {
                const addresses = await runImport();
                this.portfolioController.clearState();
                return addresses;
            } finally {
                releaseLock();
            }
        }

        return runImport();
    }

    /**
     * Verifies the validity of the current vault's seed phrase.
     *
     * Validity: seed phrase restores the accounts belonging to the current vault.
     *
     * Called when the account is created and on unlocking the vault.
     *
     * @param password
     * @param walletId
     * @returns {Promise<number[]>} The seed phrase to be confirmed by the user,
     * encoded as an array of UTF-8 bytes.
     */
    async getSeedPhrase(password: string, walletId?: string) {
        return this._convertEnglishWordlistIndicesToCodepoints(
            await this.keyringController.exportSeedPhrase(password, walletId),
        );
    }

    /**
     * Stops exposing the account with the specified address to all third parties.
     * Exposed accounts are stored in caveats of the eth_accounts permission. This
     * method uses `PermissionController.updatePermissionsByCaveat` to
     * remove the specified address from every eth_accounts permission. If a
     * permission only included this address, the permission is revoked entirely.
     *
     * @param {string} targetAccount - The address of the account to stop exposing
     * to third parties.
     */
    removeAllAccountPermissions(targetAccount: string) {
        this.permissionController.updatePermissionsByCaveat(
            CaveatTypes.restrictReturnedAccounts,
            existingAccounts =>
                //@ts-ignore
                CaveatMutatorFactories[CaveatTypes.restrictReturnedAccounts].removeAccount(
                    targetAccount,
                    existingAccounts,
                ),
        );
    }

    /**
     * Removes an account from state / storage.
     *
     * @param {string} address - A hex address
     */
    async removeAccount(address: `0x${string}`) {
        // Remove all associated permissions
        this.removeAllAccountPermissions(address);

        // Soft-delete the account instead of removing it from the keyring.
        // This preserves the underlying account while hiding it from the UI.
        this.accountsController.softDeleteAccountByAddress(address);

        return address;
    }

    /**
     * Adds a new account, reusing soft-deleted accounts for the given wallet if available.
     *
     * @param {number} accountCount - Existing account count for the wallet (passed through to keyring when needed).
     * @param {string} walletId - The id of the wallet/keyring.
     * @returns {Promise<string>} The address of the (reused or newly created) account.
     */
    async addNewAccount(accountCount: number, walletId: string): Promise<string> {
        const accounts = this.keyringController.getAccountsByWalletId(walletId);

        for (const address of accounts) {
            const internalAccount =
                this.accountsController.getAccountByAddressIncludingDeleted(address);

            if (internalAccount?.metadata?.deleted) {
                this.accountsController.restoreDeletedAccountByAddress(address);
                return address;
            }
        }

        // No deleted accounts to reuse; fall back to creating a brand new one
        return this.keyringController.addNewAccount(accountCount, walletId);
    }

    /**
     * Removes a wallet from state / storage.
     *
     * @param {string} walletId - The id of the wallet
     */
    async removeWallet(walletId: string) {
        const accounts = this.keyringController.getAccountsByWalletId(walletId);

        for (const address of accounts) {
            // Remove all associated permissions
            this.removeAllAccountPermissions(address as `0x${string}`);
            // Remove account from the keyring;
            await this.keyringController.removeAccount(address);
        }
    }

    /**
     * Submits the user's password and attempts to unlock the vault.
     *
     * @param {string} password - The user's password
     */
    async submitPassword(password: string) {
        await this.keyringController.submitPassword(password);
    }

    /**
     * Submits a user's password to check its validity.
     *
     * @param {string} password - The user's password
     */
    async verifyPassword(password: string) {
        await this.keyringController.verifyPassword(password);
    }

    /**
     * Locks app
     */
    async setLocked() {
        return this.keyringController.setLocked();
    }

    /**
     * Creates a new Vault and create a new keychain.
     *
     * A vault, or KeyringController, is a controller that contains
     * many different account strategies, currently called Keyrings.
     * Creating it new means wiping all previous keyrings.
     *
     * A keychain, or keyring, controls many accounts with a single backup and signing strategy.
     * For example, a mnemonic phrase can generate many accounts, and is a keyring.
     *
     * @param {string} password
     * @returns {object} vault
     */
    async createNewVaultAndKeychain(password: string) {
        const releaseLock = await this.createVaultMutex.acquire();

        try {
            const walletId = await this.keyringController.createNewVaultAndKeychain(password);
            return walletId;
        } finally {
            releaseLock();
        }
    }

    /**
     * Create a new Vault and restore an existent keyring.
     *
     * @param {string} password
     * @param {number[]} encodedSeedPhrase - The seed phrase, encoded as an array
     * of UTF-8 bytes.
     */
    async createNewVaultAndRestore(password: string, encodedSeedPhrase: number[]) {
        const releaseLock = await this.createVaultMutex.acquire();

        try {
            const seedPhraseAsBuffer = Buffer.from(encodedSeedPhrase);

            // create new vault
            await this.keyringController.createNewVaultAndRestore(
                password,
                this._convertMnemonicToWordlistIndices(seedPhraseAsBuffer),
            );
            this.portfolioController.clearState();
        } finally {
            releaseLock();
        }
    }

    async createNewVaultAndRestoreWithPrivateKey(password: string, privateKey: string) {
        const releaseLock = await this.createVaultMutex.acquire();

        try {
            await this.keyringController.createNewVaultAndRestoreWithPrivateKey(
                password,
                privateKey,
            );
            this.portfolioController.clearState();
        } finally {
            releaseLock();
        }
    }

    completeOnboarding() {
        this.onboardingController.completeOnboarding();
        this.onboardingController.setOnboardingStep('done');
    }

    rejectPermissionsRequest = (requestId: string) => {
        try {
            this.permissionController.rejectPermissionsRequest(requestId);
        } catch (exp) {
            if (!(exp instanceof PermissionsRequestNotFoundError)) {
                throw exp;
            }
        }
    };

    acceptPermissionsRequest = (request: PermissionsRequest) => {
        try {
            this.permissionController.acceptPermissionsRequest(request);
        } catch (exp) {
            if (!(exp instanceof PermissionsRequestNotFoundError)) {
                throw exp;
            }
        }
    };

    removePermissionsFor = (subjects: Record<string, NonEmptyArray<string>>) => {
        try {
            this.permissionController.revokePermissions(subjects);
        } catch (exp) {
            if (!(exp instanceof PermissionsRequestNotFoundError)) {
                throw exp;
            }
        }
    };

    resolvePendingApproval = async (id: string, value?: unknown, options?: AcceptOptions) => {
        try {
            return await this.approvalController.accept(id, value, options);
        } catch (exp) {
            if (!(exp instanceof ApprovalRequestNotFoundError)) {
                throw exp;
            }
        }
    };

    rejectPendingApproval = (id: string, error: any) => {
        try {
            this.approvalController.reject(
                id,
                new EthereumRpcError(error.code, error.message, error.data),
            );
        } catch (exp) {
            if (!(exp instanceof ApprovalRequestNotFoundError)) {
                throw exp;
            }
        }
    };

    /**
     * Gets the permitted accounts for the specified origin. Returns an empty
     * array if no accounts are permitted.
     *
     * @param {string} origin - The origin whose exposed accounts to retrieve.
     * @param {boolean} [suppressUnauthorizedError] - Suppresses the unauthorized error.
     * @returns {Promise<string[]>} The origin's permitted accounts, or an empty
     * array.
     */
    async getPermittedAccounts(origin: string, { suppressUnauthorizedError = true } = {}) {
        try {
            const permissionState = this.permissionController.state;
            const subjects = permissionState.subjects || {};
            const subject = subjects[origin];

            if (subject) {
                const exposedAccounts = getAccountsFromSubject(subject) as string[];
                return exposedAccounts;
            }

            return [];
        } catch (error: any) {
            if (suppressUnauthorizedError && error.code === rpcErrorCodes.provider.unauthorized) {
                return [];
            }
            throw error;
        }
    }

    /**
     * Gets relevant state for the provider of an external origin.
     *
     * @param {string} origin - The origin to get the provider state for.
     * @returns {Promise<{ isUnlocked: boolean, networkVersion: string, chainId: string, accounts: string[] }>} An object with relevant state properties.
     */
    async getProviderState(origin: string) {
        const providerState = this.getProviderNetworkState();
        const data = {
            isUnlocked: this.isUnlocked(),
            accounts: await this.getPermittedAccounts(origin),
            ...providerState,
        };
        return data;
    }

    /**
     * Retrieves network state information relevant for external providers.
     *
     * @param {string} origin - The origin identifier for which network state is requested (default: 'chilly').
     * @returns {object} An object containing important network state properties, including chainId and networkVersion.
     */
    getProviderNetworkState() {
        const chainId = toHex(this.networkController.getSelectedNetwork().chain_id);

        return {
            chainId,
            networkVersion: '1',
        };
    }

    async processTransaction(
        transactionParams: TransactionParams,
        dappRequest: Record<string, any>,
    ) {
        const { id: actionId, method, origin } = dappRequest;

        const transactionOptions: AddTransactionOptions = {
            actionId,
            method,
            origin,
            requireApproval: true,
        };

        const { result } = await this.transactionController.addTransaction(transactionParams, {
            ...transactionOptions,
        });

        const waitForHash = () => result;
        return (await waitForHash()) as string;
    }

    /**
     * A method for recording whether the app user interface is open or not.
     *
     * @param {boolean} open
     */
    set isClientOpen(open: boolean) {
        this._isClientOpen = open;
    }

    /**
     * A method that is called by the background when all instances of app are closed.
     * Currently used to stop polling in the gasFeeController.
     */
    onClientClosed() {
        try {
        } catch (error) {
            logger.error(error);
        }
    }

    /**
     * A method that is called by the background when a particular environment type is closed (fullscreen, popup, notification).
     * Currently used to stop polling in the gasFeeController for only that environement type
     *
     * @param environmentType
     */
    onEnvironmentTypeClosed(environmentTyp: EnvironmentType) {}

    /**
     * Adds a reference to a connection by origin. Ignores the 'chilly' origin.
     * Caller must ensure that the returned id is stored such that the reference
     * can be deleted later.
     *
     * @param {string} origin - The connection's origin string.
     * @param {object} options - Data associated with the connection
     * @param {object} options.engine - The connection's JSON Rpc Engine
     * @returns {string} The connection's id (so that it can be deleted later)
     */
    addConnection(origin: string, { engine }: { engine: JsonRpcEngine }) {
        if (origin === ORIGIN_CHILLY) {
            return null;
        }

        if (!this.connections[origin]) {
            this.connections[origin] = {};
        }

        const id = nanoid();
        this.connections[origin][id] = {
            engine,
        };

        return id;
    }

    /**
     * Deletes a reference to a connection, by origin and id.
     * Ignores unknown origins.
     *
     * @param {string} origin - The connection's origin string.
     * @param {string} id - The connection's id, as returned from addConnection.
     */
    removeConnection(origin: string, id: string) {
        const connections = this.connections[origin];
        if (!connections) {
            return;
        }

        delete connections[id];

        if (Object.keys(connections).length === 0) {
            delete this.connections[origin];
        }
    }

    /**
     * Closes all connections for the given origin, and removes the references
     * to them.
     * Ignores unknown origins.
     *
     * @param {string} origin - The origin string.
     */
    removeAllConnections(origin: string) {
        const connections = this.connections[origin];
        if (!connections) {
            return;
        }

        Object.keys(connections).forEach(id => {
            this.removeConnection(origin, id);
        });
    }

    /**
     * Causes the RPC engines associated with the connections to the given origin
     * to emit a notification event with the given payload.
     *
     * The caller is responsible for ensuring that only permitted notifications
     * are sent.
     *
     * Ignores unknown origins.
     */
    notifyConnections(origin: string, payload: any) {
        const connections = this.connections[origin];

        if (connections) {
            Object.values(connections).forEach(conn => {
                if (conn.engine) {
                    conn.engine.emit('notification', payload);
                }
            });
        }
    }

    /**
     * Causes the RPC engines associated with all connections to emit a
     * notification event with the given payload.
     *
     * If the "payload" parameter is a function, the payload for each connection
     * will be the return value of that function called with the connection's
     * origin.
     *
     * The caller is responsible for ensuring that only permitted notifications
     * are sent.
     */
    notifyAllConnections(payload: any) {
        const getPayload =
            typeof payload === 'function' ? (origin: string) => payload(origin) : () => payload;

        Object.keys(this.connections).forEach(origin => {
            Object.values(this.connections[origin]).forEach(async conn => {
                try {
                    if (conn.engine) {
                        conn.engine.emit('notification', await getPayload(origin));
                    }
                } catch (err) {
                    logger.error(err);
                }
            });
        });
    }

    async _notifyAccountsChange(origin: string, newAccounts: string[]) {
        if (this.isUnlocked()) {
            this.notifyConnections(origin, {
                method: NOTIFICATION_NAMES.accountsChanged,
                // This should be the same as the return value of `eth_accounts`,
                // namely an array of the current / most recently selected Ethereum
                // account.
                params:
                    newAccounts.length < 2
                        ? // If the length is 1 or 0, the accounts are sorted by definition.
                          newAccounts
                        : // If the length is 2 or greater, we have to execute
                          // `eth_accounts` vi this method.
                          await this.getPermittedAccounts(origin),
            });
        }
    }

    /**
     * Handle selected account change - notify all connected origins.
     */
    async _onSelectedAccountChange() {
        if (!this.isUnlocked()) {
            return;
        }

        const currentAccount = this.accountsController.getSelectedAccount();
        if (!currentAccount) {
            return;
        }

        const permissionState = this.permissionController.state;
        const subjects = permissionState.subjects || {};

        for (const [origin] of Object.entries(subjects)) {
            let exposedAccounts = await this.getPermittedAccounts(origin);

            if (exposedAccounts.length > 0) {
                // Update storage: move current account to top
                if (exposedAccounts.includes(currentAccount.address)) {
                    exposedAccounts = [
                        currentAccount.address,
                        ...exposedAccounts.filter(addr => addr !== currentAccount.address),
                    ];

                    // Update the caveat to persist the current account at the top
                    this.permissionController.updateCaveat(
                        origin,
                        RestrictedMethods.eth_accounts,
                        CaveatTypes.restrictReturnedAccounts,
                        exposedAccounts as never,
                    );
                }

                // Notify the origin that the accounts have changed
                await this._notifyAccountsChange(origin, exposedAccounts);
            }
        }
    }

    async _notifyChainChange() {
        this.notifyAllConnections({
            method: NOTIFICATION_NAMES.chainChanged,
            params: this.getProviderNetworkState(),
        });
    }

    /**
     * Handle global application unlock.
     */
    _onUnlock() {
        this.appStateController?.handleUnlock();

        // In the current implementation, this handler is triggered by a
        // KeyringController event. Other controllers subscribe to the 'unlock'
        // event of the AppController itself.
        this.emit('unlock');
    }

    _onNetworkChange() {
        // No caches to refresh on network change.
    }

    /**
     * Handle global application lock.
     */
    _onLock() {
        // In the current implementation, this handler is triggered by a
        // KeyringController event. Other controllers subscribe to the 'lock'
        // event of the AppController itself.
        this.emit('lock');
    }

    /**
     * A method for emitting the full app state to all registered listeners.
     *
     * @private
     */
    privateSendUpdate() {
        this.emit('update', this.getState());
    }

    isUnlocked() {
        return this.keyringController.state.isUnlocked;
    }

    /**
     * Get the RPC config for the controllers.
     * @returns {object} An object containing the custom networks and RPC URLs.
     */
    private getRpcConfigForControllers() {
        const preferences =
            this.preferencesController && this.preferencesController.getPreferences
                ? this.preferencesController.getPreferences()
                : {};

        const customNetworks = preferences.customNetworks ?? [];
        const rpcUrls = preferences.rpcUrls ?? {};

        return {
            customNetworks,
            rpcUrls,
        };
    }
}
