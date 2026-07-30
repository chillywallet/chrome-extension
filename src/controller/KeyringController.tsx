import type { TxData, TypedTransaction } from '@ethereumjs/tx';
import { isHexString, toBuffer } from '@ethereumjs/util';
import type { RestrictedControllerMessenger } from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import * as encryptorUtils from '@metamask/browser-passworder';
//@ts-ignore
import HDKeyring from '@metamask/eth-hd-keyring';
import { normalize as ethNormalize } from '@metamask/eth-sig-util';
import SimpleKeyring from '@metamask/eth-simple-keyring';
import type {
    EthBaseTransaction,
    EthBaseUserOperation,
    EthKeyring,
    EthUserOperation,
    EthUserOperationPatch,
    KeyringExecutionContext,
} from '@metamask/keyring-api';
import type { Eip1024EncryptedData, Hex, Json, KeyringClass } from '@metamask/utils';
import {
    assertIsStrictHexString,
    hasProperty,
    isObject,
    isStrictHexString,
    isValidHexAddress,
    isValidJson,
    remove0x,
} from '@metamask/utils';
import type { MutexInterface } from 'async-mutex';
import { Mutex } from 'async-mutex';
import type { Patch } from 'immer';
import {
    Chain,
    createWalletClient,
    http,
    publicActions,
    TypedData,
    TypedDataDefinition,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
    createLedgerHardwarePreviewSession,
    ledgerPreviewDispose,
    ledgerPreviewGetAddressPage,
    type LedgerHardwarePreviewSession,
} from '../lib/ledger/ledgerHardwarePreview';
import {
    LEDGER_ERR_NO_SESSION_BEFORE_IMPORT,
    LEDGER_ERR_SELECT_AT_LEAST_ONE_ADDRESS,
    LEDGER_ERR_WALLET_NOT_FOUND,
} from '../lib/ledger/ledgerErrorMessages';
import type { LedgerOffscreenKeyring } from '../lib/ledger/LedgerOffscreenKeyring';
import type { PersonalMessageParams, TypedMessageParams } from '../lib/message-manager';
import {
    createTrezorHardwarePreviewSession,
    trezorPreviewDispose,
    trezorPreviewGetAddressPage,
    type TrezorHardwarePreviewSession,
} from '../lib/trezor/trezorHardwarePreview';
import type { TrezorOffscreenKeyring } from '../lib/trezor/TrezorOffscreenKeyring';
import { getUUIDFromAddress, getUUIDFromMnemonic } from '../lib/WalletUtils';

const name = 'KeyringController';

export enum KeyringControllerError {
    NoKeyring = 'No keyring found',
    KeyringNotFound = 'Keyring not found.',
    UnsafeDirectKeyringAccess = 'Returning keyring instances is unsafe',
    WrongPasswordType = 'Password must be of type string.',
    InvalidEmptyPassword = 'Password cannot be empty.',
    NoFirstAccount = 'First Account not found.',
    DuplicatedAccount = 'Wallet already exists for this seed phrase. Please try a different one.',
    DuplicatedSimpleAccount = 'Wallet already exists for this private key. Please try a different one.',
    VaultError = 'Cannot unlock without a previous vault.',
    VaultDataError = 'The decrypted vault has an unexpected shape.',
    UnsupportedEncryptionKeyExport = 'The encryptor does not support encryption key export.',
    UnsupportedGenerateRandomMnemonic = 'The current keyring does not support the method generateRandomMnemonic.',
    UnsupportedExportAccount = 'The keyring for the current address does not support the method exportAccount',
    UnsupportedRemoveAccount = 'The keyring for the current address does not support the method removeAccount',
    UnsupportedSignTransaction = 'The keyring for the current address does not support the method signTransaction.',
    UnsupportedSignMessage = 'The keyring for the current address does not support the method signMessage.',
    UnsupportedSignPersonalMessage = 'The keyring for the current address does not support the method signPersonalMessage.',
    UnsupportedGetEncryptionPublicKey = 'The keyring for the current address does not support the method getEncryptionPublicKey.',
    UnsupportedDecryptMessage = 'The keyring for the current address does not support the method decryptMessage.',
    UnsupportedSignTypedMessage = 'The keyring for the current address does not support the method signTypedMessage.',
    UnsupportedGetAppKeyAddress = 'The keyring for the current address does not support the method getAppKeyAddress.',
    UnsupportedExportAppKeyForAddress = 'The keyring for the current address does not support the method exportAppKeyForAddress.',
    UnsupportedPrepareUserOperation = 'The keyring for the current address does not support the method prepareUserOperation.',
    UnsupportedPatchUserOperation = 'The keyring for the current address does not support the method patchUserOperation.',
    UnsupportedSignUserOperation = 'The keyring for the current address does not support the method signUserOperation.',
    NoAccountOnKeychain = "The keychain doesn't have accounts.",
    MissingCredentials = 'Cannot persist vault without password and encryption key',
    MissingVaultData = 'Cannot persist vault without vault information',
    ExpiredCredentials = 'Encryption key and salt provided are expired',
    NoKeyringBuilder = 'No keyringBuilder found for keyring',
    DataType = 'Incorrect data type provided',
    NoPrimaryKeyring = 'No Primary Keyring found',
    ControllerLockRequired = 'attempt to update vault during a non mutually exclusive operation',
}

/**
 * Available keyring types
 */
export enum KeyringTypes {
    simple = 'Simple Key Pair',
    hd = 'HD Key Tree',
    ledger = 'Ledger Hardware',
    trezor = 'Trezor Hardware',
}

/**
 * @type KeyringControllerState
 *
 * Keyring controller state
 * @property vault - Encrypted string representing keyring data
 * @property isUnlocked - Whether vault is unlocked
 * @property keyringTypes - Account types
 * @property keyrings - Group of accounts
 * @property encryptionKey - Keyring encryption key
 * @property encryptionSalt - Keyring encryption salt
 */
export type KeyringControllerState = {
    vault?: string;
    isUnlocked: boolean;
    keyrings: KeyringObject[];
    encryptionKey?: string;
    encryptionSalt?: string;
};

export type KeyringControllerMemState = Omit<
    KeyringControllerState,
    'vault' | 'encryptionKey' | 'encryptionSalt'
>;

export type KeyringControllerGetStateAction = {
    type: `${typeof name}:getState`;
    handler: () => KeyringControllerState;
};

export type KeyringControllerSignMessageAction = {
    type: `${typeof name}:signMessage`;
    handler: KeyringController['signMessage'];
};

export type KeyringControllerSignPersonalMessageAction = {
    type: `${typeof name}:signPersonalMessage`;
    handler: KeyringController['signPersonalMessage'];
};

export type KeyringControllerSignTypedMessageAction = {
    type: `${typeof name}:signTypedMessage`;
    handler: KeyringController['signTypedMessage'];
};

export type KeyringControllerSignAuthorizationAction = {
    type: `${typeof name}:signAuthorization`;
    handler: KeyringController['signAuthorization'];
};

export type KeyringControllerSignTypedMessageUsingViemAction = {
    type: `${typeof name}:signTypedMessageUsingViem`;
    handler: KeyringController['signTypedMessageUsingViem'];
};

export type KeyringControllerSendTransactionUsingViemAction = {
    type: `${typeof name}:sendTransactionUsingViem`;
    handler: KeyringController['sendTransactionUsingViem'];
};

export type KeyringControllerDecryptMessageAction = {
    type: `${typeof name}:decryptMessage`;
    handler: KeyringController['decryptMessage'];
};

export type KeyringControllerGetEncryptionPublicKeyAction = {
    type: `${typeof name}:getEncryptionPublicKey`;
    handler: KeyringController['getEncryptionPublicKey'];
};

export type KeyringControllerGetKeyringsByTypeAction = {
    type: `${typeof name}:getKeyringsByType`;
    handler: KeyringController['getKeyringsByType'];
};

export type KeyringControllerGetHDKeyringByWalletId = {
    type: `${typeof name}:getHDKeyringByWalletId`;
    handler: KeyringController['getHDKeyringByWalletId'];
};

export type KeyringControllerGetKeyringByWalletId = {
    type: `${typeof name}:getKeyringByWalletId`;
    handler: KeyringController['getKeyringByWalletId'];
};

export type KeyringControllerGetKeyringForAccountAction = {
    type: `${typeof name}:getKeyringForAccount`;
    handler: KeyringController['getKeyringForAccount'];
};

export type KeyringControllerGetAccountsAction = {
    type: `${typeof name}:getAccounts`;
    handler: KeyringController['getAccounts'];
};

export type KeyringControllerGetAccountsByWalletIdAction = {
    type: `${typeof name}:getAccountsByWalletId`;
    handler: KeyringController['getAccountsByWalletId'];
};

export type KeyringControllerPersistAllKeyringsAction = {
    type: `${typeof name}:persistAllKeyrings`;
    handler: KeyringController['persistAllKeyrings'];
};

export type KeyringControllerPrepareUserOperationAction = {
    type: `${typeof name}:prepareUserOperation`;
    handler: KeyringController['prepareUserOperation'];
};

export type KeyringControllerPatchUserOperationAction = {
    type: `${typeof name}:patchUserOperation`;
    handler: KeyringController['patchUserOperation'];
};

export type KeyringControllerSignUserOperationAction = {
    type: `${typeof name}:signUserOperation`;
    handler: KeyringController['signUserOperation'];
};

export type KeyringControllerStateChangeEvent = {
    type: `${typeof name}:stateChange`;
    payload: [KeyringControllerState, Patch[]];
};

export type KeyringControllerAccountRemovedEvent = {
    type: `${typeof name}:accountRemoved`;
    payload: [string];
};

export type KeyringControllerLockEvent = {
    type: `${typeof name}:lock`;
    payload: [];
};

export type KeyringControllerUnlockEvent = {
    type: `${typeof name}:unlock`;
    payload: [];
};

export type KeyringControllerActions =
    | KeyringControllerGetStateAction
    | KeyringControllerSignMessageAction
    | KeyringControllerSignPersonalMessageAction
    | KeyringControllerSignTypedMessageAction
    | KeyringControllerSignAuthorizationAction
    | KeyringControllerSignTypedMessageUsingViemAction
    | KeyringControllerSendTransactionUsingViemAction
    | KeyringControllerDecryptMessageAction
    | KeyringControllerGetEncryptionPublicKeyAction
    | KeyringControllerGetAccountsAction
    | KeyringControllerGetKeyringsByTypeAction
    | KeyringControllerGetHDKeyringByWalletId
    | KeyringControllerGetKeyringByWalletId
    | KeyringControllerGetAccountsByWalletIdAction
    | KeyringControllerGetKeyringForAccountAction
    | KeyringControllerPersistAllKeyringsAction
    | KeyringControllerPrepareUserOperationAction
    | KeyringControllerPatchUserOperationAction
    | KeyringControllerSignUserOperationAction;

export type KeyringControllerEvents =
    | KeyringControllerStateChangeEvent
    | KeyringControllerLockEvent
    | KeyringControllerUnlockEvent
    | KeyringControllerAccountRemovedEvent;

export type KeyringControllerMessenger = RestrictedControllerMessenger<
    typeof name,
    KeyringControllerActions,
    KeyringControllerEvents,
    never,
    never
>;

export type KeyringControllerOptions = {
    keyringBuilders?: { (): EthKeyring<Json>; type: string }[];
    messenger: KeyringControllerMessenger;
    state?: { vault?: string };
} & (
    | {
          cacheEncryptionKey: true;
          encryptor?: ExportableKeyEncryptor;
      }
    | {
          cacheEncryptionKey?: false;
          encryptor?: GenericEncryptor | ExportableKeyEncryptor;
      }
);

/**
 * @type KeyringObject
 *
 * Keyring object to return in fullUpdate
 * @property type - Keyring type
 * @property accounts - Associated accounts
 */
export type KeyringObject = {
    id: string;
    accounts: string[];
    type: string;
};

/**
 * The `signTypedMessage` version
 *
 */
export enum SignTypedDataVersion {
    V1 = 'V1',
    V3 = 'V3',
    V4 = 'V4',
}

/**
 * A serialized keyring object.
 */
export type SerializedKeyring = {
    type: string;
    data: Json;
};

/**
 * A generic encryptor interface that supports encrypting and decrypting
 * serializable data with a password.
 */
export type GenericEncryptor = {
    /**
     * Encrypts the given object with the given password.
     *
     * @param password - The password to encrypt with.
     * @param object - The object to encrypt.
     * @returns The encrypted string.
     */
    encrypt: (password: string, object: Json) => Promise<string>;
    /**
     * Decrypts the given encrypted string with the given password.
     *
     * @param password - The password to decrypt with.
     * @param encryptedString - The encrypted string to decrypt.
     * @returns The decrypted object.
     */
    decrypt: (password: string, encryptedString: string) => Promise<unknown>;
    /**
     * Optional vault migration helper. Checks if the provided vault is up to date
     * with the desired encryption algorithm.
     *
     * @param vault - The encrypted string to check.
     * @param targetDerivationParams - The desired target derivation params.
     * @returns The updated encrypted string.
     */
    isVaultUpdated?: (
        vault: string,
        targetDerivationParams?: encryptorUtils.KeyDerivationOptions,
    ) => boolean;
};

/**
 * An encryptor interface that supports encrypting and decrypting
 * serializable data with a password, and exporting and importing keys.
 */
export type ExportableKeyEncryptor = GenericEncryptor & {
    /**
     * Encrypts the given object with the given encryption key.
     *
     * @param key - The encryption key to encrypt with.
     * @param object - The object to encrypt.
     * @returns The encryption result.
     */
    encryptWithKey: (key: unknown, object: Json) => Promise<encryptorUtils.EncryptionResult>;
    /**
     * Encrypts the given object with the given password, and returns the
     * encryption result and the exported key string.
     *
     * @param password - The password to encrypt with.
     * @param object - The object to encrypt.
     * @param salt - The optional salt to use for encryption.
     * @returns The encrypted string and the exported key string.
     */
    encryptWithDetail: (
        password: string,
        object: Json,
        salt?: string,
    ) => Promise<encryptorUtils.DetailedEncryptionResult>;
    /**
     * Decrypts the given encrypted string with the given encryption key.
     *
     * @param key - The encryption key to decrypt with.
     * @param encryptedString - The encrypted string to decrypt.
     * @returns The decrypted object.
     */
    decryptWithKey: (key: unknown, encryptedString: string) => Promise<unknown>;
    /**
     * Decrypts the given encrypted string with the given password, and returns
     * the decrypted object and the salt and exported key string used for
     * encryption.
     *
     * @param password - The password to decrypt with.
     * @param encryptedString - The encrypted string to decrypt.
     * @returns The decrypted object and the salt and exported key string used for
     * encryption.
     */
    decryptWithDetail: (
        password: string,
        encryptedString: string,
    ) => Promise<encryptorUtils.DetailedDecryptResult>;
    /**
     * Generates an encryption key from exported key string.
     *
     * @param key - The exported key string.
     * @returns The encryption key.
     */
    importKey: (key: string) => Promise<unknown>;
};

export type KeyringSelector =
    | {
          type: string;
          index?: number;
      }
    | {
          address: Hex;
      };

/**
 * A function executed within a mutually exclusive lock, with
 * a mutex releaser in its option bag.
 *
 * @param releaseLock - A function to release the lock.
 */
export type MutuallyExclusiveCallback<T> = ({
    releaseLock,
}: {
    releaseLock: MutexInterface.Releaser;
}) => Promise<T>;

/**
 * Get builder function for `Keyring`
 *
 * Returns a builder function for `Keyring` with a `type` property.
 *
 * @param KeyringConstructor - The Keyring class for the builder.
 * @returns A builder function for the given Keyring.
 */
export function keyringBuilderFactory(KeyringConstructor: KeyringClass<Json>) {
    const builder = () => new KeyringConstructor();

    builder.type = KeyringConstructor.type;

    return builder;
}

const defaultKeyringBuilders = [
    //@ts-ignore
    keyringBuilderFactory(SimpleKeyring),
    keyringBuilderFactory(HDKeyring),
];

export const getDefaultKeyringState = (): KeyringControllerState => {
    return {
        isUnlocked: false,
        keyrings: [],
    };
};

/**
 * Assert that the given keyring has an exportable
 * mnemonic.
 *
 * @param keyring - The keyring to check
 * @throws When the keyring does not have a mnemonic
 */
function assertHasUint8ArrayMnemonic(
    keyring: EthKeyring<Json>,
): asserts keyring is EthKeyring<Json> & { mnemonic: Uint8Array } {
    if (!(hasProperty(keyring, 'mnemonic') && keyring.mnemonic instanceof Uint8Array)) {
        throw new Error("Can't get mnemonic bytes from keyring");
    }
}

/**
 * Assert that the provided encryptor supports
 * encryption and encryption key export.
 *
 * @param encryptor - The encryptor to check.
 * @throws If the encryptor does not support key encryption.
 */
function assertIsExportableKeyEncryptor(
    encryptor: GenericEncryptor | ExportableKeyEncryptor,
): asserts encryptor is ExportableKeyEncryptor {
    if (
        !(
            'importKey' in encryptor &&
            typeof encryptor.importKey === 'function' &&
            'decryptWithKey' in encryptor &&
            typeof encryptor.decryptWithKey === 'function' &&
            'encryptWithKey' in encryptor &&
            typeof encryptor.encryptWithKey === 'function'
        )
    ) {
        throw new Error(KeyringControllerError.UnsupportedEncryptionKeyExport);
    }
}

/**
 * Assert that the provided password is a valid non-empty string.
 *
 * @param password - The password to check.
 * @throws If the password is not a valid string.
 */
function assertIsValidPassword(password: unknown): asserts password is string {
    if (typeof password !== 'string') {
        throw new Error(KeyringControllerError.WrongPasswordType);
    }

    if (!password || !password.length) {
        throw new Error(KeyringControllerError.InvalidEmptyPassword);
    }
}

/**
 * Checks if the provided value is a serialized keyrings array.
 *
 * @param array - The value to check.
 * @returns True if the value is a serialized keyrings array.
 */
function isSerializedKeyringsArray(array: unknown): array is SerializedKeyring[] {
    return (
        typeof array === 'object' &&
        Array.isArray(array) &&
        array.every(value => value.type && isValidJson(value.data))
    );
}

/**
 * Display For Keyring
 *
 * Is used for adding the current keyrings to the state object.
 *
 * @param keyring - The keyring to display.
 * @returns A keyring display object, with type and accounts properties.
 */
async function displayForKeyring(keyring: EthKeyring<Json>): Promise<KeyringObject> {
    const accounts = await keyring.getAccounts();

    if (keyring.type === KeyringTypes.ledger) {
        const serialized = await keyring.serialize();
        const record =
            serialized && typeof serialized === 'object' && !Array.isArray(serialized)
                ? (serialized as Record<string, Json>)
                : {};
        const ledgerDiscoveryId =
            typeof record.ledgerDiscoveryId === 'string' ? record.ledgerDiscoveryId : '';

        return {
            id: ledgerDiscoveryId,
            type: KeyringTypes.ledger,
            accounts: accounts.map(normalize).filter((a): a is string => Boolean(a)),
        };
    }

    if (keyring.type === KeyringTypes.trezor) {
        const serialized = await keyring.serialize();
        const record =
            serialized && typeof serialized === 'object' && !Array.isArray(serialized)
                ? (serialized as Record<string, Json>)
                : {};
        const trezorDiscoveryId =
            typeof record.trezorDiscoveryId === 'string' ? record.trezorDiscoveryId : '';

        return {
            id: trezorDiscoveryId,
            type: KeyringTypes.trezor,
            accounts: accounts.map(normalize).filter((a): a is string => Boolean(a)),
        };
    }

    if (keyring.type === KeyringTypes.simple) {
        const [first] = accounts;

        if (!first) {
            throw new Error(KeyringControllerError.NoAccountOnKeychain);
        }

        return {
            id: getUUIDFromAddress(first),
            type: keyring.type,
            // Cast to `string[]` here is safe here because `accounts` has no nullish
            // values, and `normalize` returns `string` unless given a nullish value
            accounts: accounts.map(normalize) as string[],
        };
    }

    assertHasUint8ArrayMnemonic(keyring);

    return {
        id: getUUIDFromMnemonic(keyring.mnemonic),
        type: keyring.type,
        // Cast to `string[]` here is safe here because `accounts` has no nullish
        // values, and `normalize` returns `string` unless given a nullish value
        accounts: accounts.map(normalize) as string[],
    };
}

/**
 * Check if address is an ethereum address
 *
 * @param address - An address.
 * @returns Returns true if the address is an ethereum one, false otherwise.
 */
function isEthAddress(address: string): boolean {
    // We first check if it's a matching `Hex` string, so that is narrows down
    // `address` as an `Hex` type, allowing us to use `isValidHexAddress`
    return (
        // NOTE: This function only checks for lowercased strings
        isStrictHexString(address.toLowerCase()) &&
        // This checks for lowercased addresses and checksum addresses too
        isValidHexAddress(address as Hex)
    );
}

/**
 * Normalize ethereum or non-EVM address.
 *
 * @param address - Ethereum or non-EVM address.
 * @returns The normalized address.
 */
function normalize(address: string): string | undefined {
    // Since the `KeyringController` is only dealing with address, we have
    // no other way to get the associated account type with this address. So we
    // are down to check the actual address format for now
    // TODO: Find a better way to not have those runtime checks based on the
    //       address value!
    return isEthAddress(address) ? ethNormalize(address) : address;
}

/**
 * Ledger (`Buffer.from(hex, 'hex')`) and Trezor (`ethereumSignMessage` + `hex: true`) expect
 * hex-encoded **message bytes**. Those bytes must match @metamask/eth-sig-util `legacyToBuffer`
 * — the same rules as `personalSign` / `recoverPersonalSignature` and soft keyrings.
 *
 * In particular, strings that are hex **without** a `0x` prefix are treated as UTF-8 text, not
 * as raw binary hex (ethereumjs `isHexString` is false for unprefixed values).
 */
function encodePersonalSignPayload(data: string): Hex {
    const n = normalize(data);
    if (n === undefined || n === '') {
        throw new Error("Can't sign an empty message");
    }
    const messageBuf =
        typeof n === 'string' && !isHexString(n)
            ? Buffer.from(n, 'utf8')
            : toBuffer(n as `0x${string}`);
    return (`0x${messageBuf.toString('hex')}`) as Hex;
}

/**
 * Controller responsible for establishing and managing user identity.
 *
 * This class is a wrapper around the `eth-keyring-controller` package. The
 * `eth-keyring-controller` manages the "vault", which is an encrypted store of private keys, and
 * it manages the wallet "lock" state. This wrapper class has convenience methods for interacting
 * with the internal keyring controller and handling certain complex operations that involve the
 * keyrings.
 */
export class KeyringController extends BaseController<
    typeof name,
    KeyringControllerState,
    KeyringControllerMessenger
> {
    readonly #controllerOperationMutex = new Mutex();

    readonly #vaultOperationMutex = new Mutex();

    #keyringBuilders: { (): EthKeyring<Json>; type: string }[];

    #keyrings: EthKeyring<Json>[];

    /** In-memory Ledger connect flow: address pages before a vault Ledger keyring exists. */
    #ledgerHardwarePreviewSession: LedgerHardwarePreviewSession | null = null;

    /** In-memory Trezor connect flow: address pages before a vault Trezor keyring exists. */
    #trezorHardwarePreviewSession: TrezorHardwarePreviewSession | null = null;

    #unsupportedKeyrings: SerializedKeyring[];

    #password?: string;

    #encryptor: GenericEncryptor | ExportableKeyEncryptor;

    #cacheEncryptionKey: boolean;

    /**
     * Creates a KeyringController instance.
     *
     * @param options - Initial options used to configure this controller
     * @param options.encryptor - An optional object for defining encryption schemes.
     * @param options.keyringBuilders - Set a new name for account.
     * @param options.cacheEncryptionKey - Whether to cache or not encryption key.
     * @param options.messenger - A restricted controller messenger.
     * @param options.state - Initial state to set on this controller.
     */
    constructor(options: KeyringControllerOptions) {
        const { encryptor = encryptorUtils, keyringBuilders, messenger, state } = options;

        super({
            name,
            metadata: {
                vault: { persist: true, anonymous: false },
                isUnlocked: { persist: false, anonymous: true },
                keyrings: { persist: false, anonymous: false },
                encryptionKey: { persist: false, anonymous: false },
                encryptionSalt: { persist: false, anonymous: false },
            },
            messenger,
            state: {
                ...getDefaultKeyringState(),
                ...state,
            },
        });

        this.#keyringBuilders = keyringBuilders
            ? defaultKeyringBuilders.concat(keyringBuilders)
            : defaultKeyringBuilders;

        this.#encryptor = encryptor;
        this.#keyrings = [];
        this.#unsupportedKeyrings = [];

        // This option allows the controller to cache an exported key
        // for use in decrypting and encrypting data without password
        this.#cacheEncryptionKey = Boolean(options.cacheEncryptionKey);
        if (this.#cacheEncryptionKey) {
            assertIsExportableKeyEncryptor(encryptor);
        }

        this.#registerMessageHandlers();
    }

    /**
     * Adds a new account to the HD seed phrase keyring.
     *
     * @param accountCount - Number of accounts before adding a new one, used to
     * make the method idempotent.
     * @param walletId - Wallet id of the HD wallet that we want to add new account.
     * @returns Promise resolving to the added account address.
     */
    async addNewAccount(accountCount: number, walletId: string): Promise<string> {
        return this.#persistOrRollback(async () => {
            const keyring = this.getHDKeyringByWalletId(walletId);

            if (!keyring) {
                throw new Error('No HD keyring found for walletId: ' + walletId);
            }
            const oldAccounts = await keyring.getAccounts();

            if (accountCount && oldAccounts.length !== accountCount) {
                if (accountCount > oldAccounts.length) {
                    throw new Error('Account out of sequence');
                }
                // we return the account already existing at index `accountCount`
                const existingAccount = oldAccounts[accountCount];

                if (!existingAccount) {
                    throw new Error(`Can't find account at index ${accountCount}`);
                }

                return existingAccount;
            }

            const [addedAccountAddress] = await keyring.addAccounts(1);
            await this.verifySeedPhrase(walletId);

            return addedAccountAddress;
        });
    }

    /**
     * Adds a new HD wallet.
     *
     * @param seed - A BIP39-compliant seed phrase as Uint8Array,
     * either as a string or an array of UTF-8 bytes that represent the string.
     * @returns Promise resolving when the operation ends successfully.
     */
    addNewWallet(seed?: Uint8Array) {
        return this.#persistOrRollback<Uint8Array>(async () => {
            assertIsValidPassword(this.#password);

            const keyring = (await this.#newKeyring(
                KeyringTypes.hd,
                seed
                    ? {
                          mnemonic: seed,
                          numberOfAccounts: 1,
                      }
                    : undefined,
            )) as EthKeyring<Json>;
            assertHasUint8ArrayMnemonic(keyring);
            return keyring.mnemonic;
        });
    }

    /**
     * Adds a new wallet with a private key.
     *
     * @param privateKey - A private key as string.
     * @returns Promise resolving to the wallet address.
     */
    addNewWalletWithPrivateKey(privateKey: string) {
        return this.#persistOrRollback<string>(async () => {
            assertIsValidPassword(this.#password);

            const keyring = await this.#newKeyring(KeyringTypes.simple, [
                privateKey.replace(/^0x/, ''),
            ]);
            const [firstAccount] = await keyring.getAccounts();
            assertIsStrictHexString(firstAccount);
            return firstAccount;
        });
    }

    /**
     * Adds a new account to the specified keyring.
     *
     * @param keyring - Keyring to add the account to.
     * @param accountCount - Number of accounts before adding a new one, used to make the method idempotent.
     * @returns Promise resolving to the added account address
     */
    async addNewAccountForKeyring(keyring: EthKeyring<Json>, accountCount?: number): Promise<Hex> {
        // READ THIS CAREFULLY:
        // We still uses `Hex` here, since we are not using this method when creating
        // and account using a "Snap Keyring". This function assume the `keyring` is
        // ethereum compatible, but "Snap Keyring" might not be.
        return this.#persistOrRollback(async () => {
            const oldAccounts = await this.#getAccountsFromKeyrings();

            if (accountCount && oldAccounts.length !== accountCount) {
                if (accountCount > oldAccounts.length) {
                    throw new Error('Account out of sequence');
                }

                const existingAccount = oldAccounts[accountCount];
                assertIsStrictHexString(existingAccount);

                return existingAccount;
            }

            await keyring.addAccounts(1);

            const addedAccountAddress = (await this.#getAccountsFromKeyrings()).find(
                selectedAddress => !oldAccounts.includes(selectedAddress),
            );
            assertIsStrictHexString(addedAccountAddress);

            return addedAccountAddress;
        });
    }

    /**
     * Adds a new account to the default (first) HD seed phrase keyring without updating identities in preferences.
     *
     * @param walletId - walletId of the wallet.
     * @returns Promise resolving to the added account address.
     */
    async addNewAccountWithoutUpdate(walletId: string): Promise<string> {
        return this.#persistOrRollback(async () => {
            const keyring = this.getHDKeyringByWalletId(walletId);
            if (!keyring) {
                throw new Error('No HD keyring found');
            }
            const [addedAccountAddress] = await keyring.addAccounts(1);
            await this.verifySeedPhrase(walletId);
            return addedAccountAddress;
        });
    }

    /**
     * Effectively the same as creating a new keychain then populating it
     * using the given seed phrase.
     *
     * @param password - Password to unlock keychain.
     * @param seed - A BIP39-compliant seed phrase as Uint8Array,
     * either as a string or an array of UTF-8 bytes that represent the string.
     * @returns Promise resolving when the operation ends successfully.
     */
    async createNewVaultAndRestore(password: string, seed: Uint8Array): Promise<void> {
        return this.#persistOrRollback(async () => {
            assertIsValidPassword(password);

            await this.#createNewVaultWithKeyring(password, {
                type: KeyringTypes.hd,
                opts: {
                    mnemonic: seed,
                    numberOfAccounts: 1,
                },
            });
        });
    }

    /**
     * Effectively the same as creating a new keychain then populating it
     * using the given private key.
     *
     * @param password - Password to unlock keychain.
     * @param privateKey - A private key as string.
     * @returns Promise resolving when the operation ends successfully.
     */
    async createNewVaultAndRestoreWithPrivateKey(
        password: string,
        privateKey: string,
    ): Promise<void> {
        return this.#persistOrRollback(async () => {
            assertIsValidPassword(password);

            await this.#createNewVaultWithKeyring(password, {
                type: KeyringTypes.simple,
                opts: [
                    privateKey.replace(/^0x/, ''), // Remove 0x prefix if present
                ],
            });
        });
    }

    /**
     * Create a new primary keychain and wipe any previous keychains.
     *
     * @param password - Password to unlock the new vault.
     * @returns Promise resolving when the operation ends successfully.
     */
    async createNewVaultAndKeychain(password: string) {
        return this.#persistOrRollback(async () => {
            const accounts = await this.#getAccountsFromKeyrings();
            if (!accounts.length) {
                return await this.#createNewVaultWithKeyring(password, {
                    type: KeyringTypes.hd,
                });
            }
        });
    }

    /**
     * Adds a new keyring of the given `type`.
     *
     * @param type - Keyring type name.
     * @param opts - Keyring options.
     * @throws If a builder for the given `type` does not exist.
     * @returns Promise resolving to the added keyring.
     */
    async addNewKeyring(type: KeyringTypes | string, opts?: unknown): Promise<unknown> {
        return this.#persistOrRollback(async () => this.#newKeyring(type, opts));
    }

    /** Drop ephemeral Ledger HID / pagination state used before a vault Ledger keyring exists. */
    async clearLedgerHardwarePreviewSession(): Promise<void> {
        if (!this.#ledgerHardwarePreviewSession) {
            return;
        }

        await ledgerPreviewDispose(this.#ledgerHardwarePreviewSession.instanceId);
        this.#ledgerHardwarePreviewSession = null;
    }

    async clearTrezorHardwarePreviewSession(): Promise<void> {
        if (!this.#trezorHardwarePreviewSession) {
            return;
        }

        await trezorPreviewDispose(this.#trezorHardwarePreviewSession.instanceId);
        this.#trezorHardwarePreviewSession = null;
    }

    async getLedgerHardwareAddressPage(
        direction: 'first' | 'next' | 'prev',
        ledgerWalletId?: string | null,
    ): Promise<{ address: string; index: number }[]> {
        const targetLedgerId =
            typeof ledgerWalletId === 'string' && ledgerWalletId.trim() !== ''
                ? ledgerWalletId.trim()
                : undefined;

        if (targetLedgerId !== undefined) {
            await this.clearLedgerHardwarePreviewSession();
            const keyring = await this.getKeyringByWalletId(targetLedgerId);

            if (!keyring || keyring.type !== KeyringTypes.ledger) {
                throw new Error(LEDGER_ERR_WALLET_NOT_FOUND);
            }

            return (keyring as LedgerOffscreenKeyring).getAddressPage(direction);
        }

        if (!this.#ledgerHardwarePreviewSession) {
            this.#ledgerHardwarePreviewSession = createLedgerHardwarePreviewSession();
        }

        return ledgerPreviewGetAddressPage(this.#ledgerHardwarePreviewSession, direction);
    }

    /**
     * First-wallet onboarding via hardware: no vault yet — set encryption password and unlock
     * before persisting (same role as {@link createNewVaultAndRestore} for mnemonic imports).
     */
    async #ensureVaultPasswordForFirstHardwareImport(vaultPassword?: string | null): Promise<void> {
        if (this.state.vault) {
            return;
        }

        const pw =
            typeof vaultPassword === 'string' && vaultPassword.trim() !== ''
                ? vaultPassword.trim()
                : undefined;

        if (!pw) {
            return;
        }

        assertIsValidPassword(pw);
        await this.#clearKeyrings();
        this.#password = pw;
        this.#setUnlocked();
    }

    async importLedgerHardwareAccounts(
        indices: number[],
        ledgerWalletId?: string | null,
        vaultPassword?: string | null,
    ): Promise<string[]> {
        return this.#persistOrRollback(async () => {
            const uniq = [...new Set(indices)].sort((a, b) => a - b);
            if (uniq.length === 0) {
                throw new Error(LEDGER_ERR_SELECT_AT_LEAST_ONE_ADDRESS);
            }

            const targetLedgerId =
                typeof ledgerWalletId === 'string' && ledgerWalletId.trim() !== ''
                    ? ledgerWalletId.trim()
                    : undefined;

            let ledger: LedgerOffscreenKeyring;

            if (targetLedgerId !== undefined) {
                await this.clearLedgerHardwarePreviewSession();
                const keyring = await this.getKeyringByWalletId(targetLedgerId);

                if (!keyring || keyring.type !== KeyringTypes.ledger) {
                    throw new Error(LEDGER_ERR_WALLET_NOT_FOUND);
                }

                ledger = keyring as LedgerOffscreenKeyring;
            } else {
                const preview = this.#ledgerHardwarePreviewSession;
                if (!preview) {
                    throw new Error(LEDGER_ERR_NO_SESSION_BEFORE_IMPORT);
                }

                const serializedForImport = structuredClone(preview.serialized) as Json;

                await ledgerPreviewDispose(preview.instanceId);
                this.#ledgerHardwarePreviewSession = null;

                await this.#ensureVaultPasswordForFirstHardwareImport(vaultPassword);

                ledger = (await this.#newKeyring(
                    KeyringTypes.ledger,
                    serializedForImport,
                )) as LedgerOffscreenKeyring;
            }

            const existingBeforeImport = await this.#getAccountsFromKeyrings();

            const newAddresses = await ledger.importAccountsAtIndices(uniq);

            for (const addr of newAddresses) {
                const n = normalize(addr);

                if (!n) {
                    continue;
                }

                const clash = existingBeforeImport.some(
                    ex => normalize(ex)?.toLowerCase() === n.toLowerCase(),
                );

                if (clash) {
                    throw new Error(
                        `${addr} is already in this wallet. Please deselect it and try again.`,
                    );
                }

                existingBeforeImport.push(n);
            }

            return newAddresses;
        });
    }

    async getTrezorHardwareAddressPage(
        direction: 'first' | 'next' | 'prev',
        trezorWalletId?: string | null,
    ): Promise<{ address: string; index: number }[]> {
        const targetTrezorId =
            typeof trezorWalletId === 'string' && trezorWalletId.trim() !== ''
                ? trezorWalletId.trim()
                : undefined;

        if (targetTrezorId !== undefined) {
            await this.clearTrezorHardwarePreviewSession();
            const keyring = await this.getKeyringByWalletId(targetTrezorId);

            if (!keyring || keyring.type !== KeyringTypes.trezor) {
                throw new Error('Trezor wallet not found.');
            }

            return (keyring as TrezorOffscreenKeyring).getAddressPage(direction);
        }

        if (!this.#trezorHardwarePreviewSession) {
            this.#trezorHardwarePreviewSession = createTrezorHardwarePreviewSession();
        }

        return trezorPreviewGetAddressPage(this.#trezorHardwarePreviewSession, direction);
    }

    async importTrezorHardwareAccounts(
        indices: number[],
        trezorWalletId?: string | null,
        vaultPassword?: string | null,
    ): Promise<string[]> {
        return this.#persistOrRollback(async () => {
            const uniq = [...new Set(indices)].sort((a, b) => a - b);
            if (uniq.length === 0) {
                throw new Error('Select at least one Trezor address.');
            }

            const targetTrezorId =
                typeof trezorWalletId === 'string' && trezorWalletId.trim() !== ''
                    ? trezorWalletId.trim()
                    : undefined;

            let trezor: TrezorOffscreenKeyring;

            if (targetTrezorId !== undefined) {
                await this.clearTrezorHardwarePreviewSession();
                const keyring = await this.getKeyringByWalletId(targetTrezorId);

                if (!keyring || keyring.type !== KeyringTypes.trezor) {
                    throw new Error('Trezor wallet not found.');
                }

                trezor = keyring as TrezorOffscreenKeyring;
            } else {
                const preview = this.#trezorHardwarePreviewSession;
                if (!preview) {
                    throw new Error(
                        'No Trezor session. Connect your device and load addresses before importing.',
                    );
                }

                const serializedForImport = structuredClone(preview.serialized) as Json;

                await trezorPreviewDispose(preview.instanceId);
                this.#trezorHardwarePreviewSession = null;

                await this.#ensureVaultPasswordForFirstHardwareImport(vaultPassword);

                trezor = (await this.#newKeyring(
                    KeyringTypes.trezor,
                    serializedForImport,
                )) as TrezorOffscreenKeyring;
            }

            const existingBeforeImport = await this.#getAccountsFromKeyrings();

            const newAddresses = await trezor.importAccountsAtIndices(uniq);

            for (const addr of newAddresses) {
                const n = normalize(addr);

                if (!n) {
                    continue;
                }

                const clash = existingBeforeImport.some(
                    ex => normalize(ex)?.toLowerCase() === n.toLowerCase(),
                );

                if (clash) {
                    throw new Error(
                        `${addr} is already in this wallet. Please deselect it and try again.`,
                    );
                }

                existingBeforeImport.push(n);
            }

            return newAddresses;
        });
    }

    /**
     * Method to verify a given password validity. Throws an
     * error if the password is invalid.
     *
     * @param password - Password of the keyring.
     */
    async verifyPassword(password: string) {
        if (!this.state.vault) {
            throw new Error(KeyringControllerError.VaultError);
        }
        await this.#encryptor.decrypt(password, this.state.vault);
    }

    /**
     * Returns the status of the vault.
     *
     * @returns Boolean returning true if the vault is unlocked.
     */
    isUnlocked(): boolean {
        return this.state.isUnlocked;
    }

    /**
     * Gets the seed phrase of the HD keyring.
     *
     * @param password - Password of the keyring.
     * @param walletId - walletId of the wallet.
     * @returns Promise resolving to the seed phrase.
     */
    async exportSeedPhrase(password: string, walletId?: string): Promise<Uint8Array> {
        await this.verifyPassword(password);

        const keyring = walletId ? this.getHDKeyringByWalletId(walletId) : this.#keyrings[0];

        if (!keyring) {
            throw new Error('No HD keyring found.');
        }

        assertHasUint8ArrayMnemonic(keyring);
        return keyring.mnemonic;
    }

    /**
     * Gets the private key from the keyring controlling an address.
     *
     * @param password - Password of the keyring.
     * @param address - Address to export.
     * @returns Promise resolving to the private key for an address.
     */
    async exportAccount(password: string, address: string): Promise<string> {
        await this.verifyPassword(password);

        const keyring = (await this.getKeyringForAccount(address)) as EthKeyring<Json>;

        if (!keyring.exportAccount) {
            throw new Error(KeyringControllerError.UnsupportedExportAccount);
        }

        return await keyring.exportAccount(normalize(address) as Hex);
    }

    /**
     * Gets the private key from the keyring controlling an address.
     *
     * @param password - Password of the keyring.
     * @param address - Address to export.
     * @returns Promise resolving to the private key for an address.
     */
    async getPrivateKeyInternally(address: string): Promise<string> {
        const keyring = (await this.getKeyringForAccount(address)) as EthKeyring<Json>;

        if (!keyring.exportAccount) {
            throw new Error(KeyringControllerError.UnsupportedExportAccount);
        }

        return await keyring.exportAccount(normalize(address) as Hex);
    }

    /**
     * Returns the public addresses of all accounts from every keyring.
     *
     * @returns A promise resolving to an array of addresses.
     */
    async getAccounts(): Promise<string[]> {
        return this.state.keyrings.reduce<string[]>(
            (accounts, keyring) => accounts.concat(keyring.accounts),
            [],
        );
    }

    /**
     * Get encryption public key.
     *
     * @param account - An account address.
     * @param opts - Additional encryption options.
     * @throws If the `account` does not exist or does not support the `getEncryptionPublicKey` method
     * @returns Promise resolving to encyption public key of the `account` if one exists.
     */
    async getEncryptionPublicKey(account: string, opts?: Record<string, unknown>): Promise<string> {
        const address = ethNormalize(account) as Hex;
        const keyring = (await this.getKeyringForAccount(account)) as EthKeyring<Json>;
        if (!keyring.getEncryptionPublicKey) {
            throw new Error(KeyringControllerError.UnsupportedGetEncryptionPublicKey);
        }

        return await keyring.getEncryptionPublicKey(address, opts);
    }

    /**
     * Attempts to decrypt the provided message parameters.
     *
     * @param messageParams - The decryption message parameters.
     * @param messageParams.from - The address of the account you want to use to decrypt the message.
     * @param messageParams.data - The encrypted data that you want to decrypt.
     * @returns The raw decryption result.
     */
    async decryptMessage(messageParams: {
        from: string;
        data: Eip1024EncryptedData;
    }): Promise<string> {
        const address = ethNormalize(messageParams.from) as Hex;
        const keyring = (await this.getKeyringForAccount(address)) as EthKeyring<Json>;
        if (!keyring.decryptMessage) {
            throw new Error(KeyringControllerError.UnsupportedDecryptMessage);
        }

        return keyring.decryptMessage(address, messageParams.data);
    }

    /**
     * Returns the currently initialized keyring that manages
     * the specified `address` if one exists.
     *
     * @deprecated Use of this method is discouraged as actions executed directly on
     * keyrings are not being reflected in the KeyringController state and not
     * persisted in the vault. Use `withKeyring` instead.
     * @param account - An account address.
     * @returns Promise resolving to keyring of the `account` if one exists.
     */
    async getKeyringForAccount(account: string): Promise<unknown> {
        const address = normalize(account);

        const candidates = await Promise.all(
            this.#keyrings.map(async keyring => {
                return Promise.all([keyring, keyring.getAccounts()]);
            }),
        );

        const winners = candidates.filter(candidate => {
            const accounts = candidate[1].map(normalize);
            return accounts.includes(address);
        });

        if (winners.length && winners[0]?.length) {
            return winners[0][0];
        }

        // Adding more info to the error
        let errorInfo = '';
        if (!candidates.length) {
            errorInfo = 'There are no keyrings';
        } else if (!winners.length) {
            errorInfo = 'There are keyrings, but none match the address';
        }
        throw new Error(`${KeyringControllerError.NoKeyring}. Error info: ${errorInfo}`);
    }

    /**
     * Returns all keyrings of the given type.
     *
     * @deprecated Use of this method is discouraged as actions executed directly on
     * keyrings are not being reflected in the KeyringController state and not
     * persisted in the vault. Use `withKeyring` instead.
     * @param type - Keyring type name.
     * @returns An array of keyrings of the given type.
     */
    getKeyringsByType(type: KeyringTypes | string): unknown[] {
        return this.#keyrings.filter(keyring => keyring.type === type);
    }

    /**
     * Returns the HD keyring of the given walletId.
     *
     * @param walletId - walletId of the wallet.
     * @returns A keyring of the given walletId.
     */
    getHDKeyringByWalletId(walletId: string) {
        return this.#keyrings.find(keyring => {
            if (keyring.type === KeyringTypes.hd) {
                assertHasUint8ArrayMnemonic(keyring);
                const _id = getUUIDFromMnemonic(keyring.mnemonic);

                return _id === walletId;
            }

            return false;
        });
    }

    /**
     * Returns the keyring of the given walletId.
     *
     * @param walletId - walletId of the wallet.
     * @returns A keyring of the given walletId.
     */
    async getKeyringByWalletId(walletId: string) {
        for (const keyring of this.#keyrings) {
            if (keyring.type === KeyringTypes.hd) {
                assertHasUint8ArrayMnemonic(keyring);
                const _id = getUUIDFromMnemonic(keyring.mnemonic);

                if (_id === walletId) {
                    return keyring;
                }
            } else if (keyring.type === KeyringTypes.simple) {
                const [firstAccount] = await keyring.getAccounts();

                if (!firstAccount) {
                    throw new Error(KeyringControllerError.NoFirstAccount);
                }

                const _id = getUUIDFromAddress(firstAccount);

                if (_id === walletId) {
                    return keyring;
                }
            } else if (keyring.type === KeyringTypes.ledger) {
                const serialized = await keyring.serialize();
                const record =
                    serialized && typeof serialized === 'object' && !Array.isArray(serialized)
                        ? (serialized as Record<string, Json>)
                        : {};
                const ledgerId =
                    typeof record.ledgerDiscoveryId === 'string' ? record.ledgerDiscoveryId : '';

                if (ledgerId.length > 0 && ledgerId === walletId) {
                    return keyring;
                }
            } else if (keyring.type === KeyringTypes.trezor) {
                const serialized = await keyring.serialize();
                const record =
                    serialized && typeof serialized === 'object' && !Array.isArray(serialized)
                        ? (serialized as Record<string, Json>)
                        : {};
                const trezorId =
                    typeof record.trezorDiscoveryId === 'string' ? record.trezorDiscoveryId : '';

                if (trezorId.length > 0 && trezorId === walletId) {
                    return keyring;
                }
            }
        }

        return undefined;
    }

    /**
     * Returns Ethereum addresses for a wallet id from mirrored controller state.
     * Does not invoke keyrings (avoids hardware / offscreen for Ledger).
     *
     * @param walletId - Wallet / keyring display id.
     * @returns Copy of the account address list, or empty if none.
     */
    getAccountsByWalletId(walletId: string): string[] {
        const entry = this.state.keyrings.find(k => k.id === walletId);
        return entry ? [...entry.accounts] : [];
    }

    /**
     * Persist all serialized keyrings in the vault.
     *
     * @deprecated This method is being phased out in favor of `withKeyring`.
     * @returns Promise resolving with `true` value when the
     * operation completes.
     */
    async persistAllKeyrings(): Promise<boolean> {
        return this.#persistOrRollback(async () => true);
    }

    /**
     * Removes an account from keyring state.
     *
     * @param address - Address of the account to remove.
     * @fires KeyringController:accountRemoved
     * @returns Promise resolving when the account is removed.
     */
    async removeAccount(address: string): Promise<void> {
        await this.#persistOrRollback(async () => {
            const keyring = (await this.getKeyringForAccount(address)) as EthKeyring<Json>;

            // Not all the keyrings support this, so we have to check
            if (!keyring.removeAccount) {
                throw new Error(KeyringControllerError.UnsupportedRemoveAccount);
            }

            await keyring.removeAccount(address as Hex);

            const accounts = await keyring.getAccounts();

            // Check if this was the last/only account
            if (accounts.length === 0) {
                await this.#removeEmptyKeyrings();
            }
        });

        this.messagingSystem.publish(`${name}:accountRemoved`, address);
    }

    /**
     * Deallocates all secrets and locks the wallet.
     *
     * @returns Promise resolving when the operation completes.
     */
    async setLocked(): Promise<void> {
        return this.#withRollback(async () => {
            await this.clearLedgerHardwarePreviewSession();
            await this.clearTrezorHardwarePreviewSession();
            this.#password = undefined;
            await this.#clearKeyrings();

            this.update(state => {
                state.isUnlocked = false;
                state.keyrings = [];
            });

            this.messagingSystem.publish(`${name}:lock`);
        });
    }

    /**
     * Signs message by calling down into a specific keyring.
     *
     * @param messageParams - PersonalMessageParams object to sign.
     * @returns Promise resolving to a signed message string.
     */
    async signMessage(messageParams: PersonalMessageParams): Promise<string> {
        if (!messageParams.data) {
            throw new Error("Can't sign an empty message");
        }

        const address = ethNormalize(messageParams.from) as Hex;
        const keyring = (await this.getKeyringForAccount(address)) as EthKeyring<Json>;
        if (!keyring.signMessage) {
            throw new Error(KeyringControllerError.UnsupportedSignMessage);
        }

        const payload = encodePersonalSignPayload(String(messageParams.data));
        return await keyring.signMessage(address, payload);
    }

    /**
     * Signs personal message by calling down into a specific keyring.
     *
     * @param messageParams - PersonalMessageParams object to sign.
     * @returns Promise resolving to a signed message string.
     */
    async signPersonalMessage(messageParams: PersonalMessageParams) {
        if (!messageParams.data) {
            throw new Error("Can't sign an empty message");
        }

        const address = ethNormalize(messageParams.from) as Hex;
        const keyring = (await this.getKeyringForAccount(address)) as EthKeyring<Json>;
        if (!keyring.signPersonalMessage) {
            throw new Error(KeyringControllerError.UnsupportedSignPersonalMessage);
        }

        const normalizedData = encodePersonalSignPayload(String(messageParams.data));

        return await keyring.signPersonalMessage(address, normalizedData);
    }

    /**
     * Signs typed message by calling down into a specific keyring.
     *
     * @param messageParams - TypedMessageParams object to sign.
     * @param version - Compatibility version EIP712.
     * @throws Will throw when passed an unrecognized version.
     * @returns Promise resolving to a signed message string or an error if any.
     */
    async signTypedMessage(
        messageParams: TypedMessageParams,
        version: SignTypedDataVersion,
    ): Promise<string> {
        try {
            if (
                ![
                    SignTypedDataVersion.V1,
                    SignTypedDataVersion.V3,
                    SignTypedDataVersion.V4,
                ].includes(version)
            ) {
                throw new Error(`Unexpected signTypedMessage version: '${version}'`);
            }

            // Cast to `Hex` here is safe here because `messageParams.from` is not nullish.
            // `normalize` returns `Hex` unless given a nullish value.
            const address = ethNormalize(messageParams.from) as Hex;
            const keyring = (await this.getKeyringForAccount(address)) as EthKeyring<Json>;
            if (!keyring.signTypedData) {
                throw new Error(KeyringControllerError.UnsupportedSignTypedMessage);
            }

            return await keyring.signTypedData(
                address,
                version !== SignTypedDataVersion.V1 && typeof messageParams.data === 'string'
                    ? JSON.parse(messageParams.data)
                    : messageParams.data,
                { version },
            );
        } catch (error) {
            throw new Error(`Keyring Controller signTypedMessage: ${error}`);
        }
    }

    /**
     * Signs an EIP-7702 Authorization.
     *
     * @param from - EOA address that owns the private key.
     * @param contractAddress - Invoker/contract address being authorized.
     * @param chainId - Chain ID for which the authorization is valid.
     * @param nonce - Authorization nonce.
     * @returns A SignedAuthorizationInput containing signature components.
     */
    async signAuthorization(from: string, contractAddress: Hex, chainId: number, nonce: number) {
        const privateKey = await this.getPrivateKeyInternally(from);
        const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        const account = privateKeyToAccount(normalizedPrivateKey as Hex);

        const authorization = await account.signAuthorization({
            contractAddress,
            chainId,
            nonce,
        });

        return authorization;
    }

    async signTypedMessageUsingViem(
        from: string,
        typedData: TypedDataDefinition<TypedData, 'EIP712Domain'>,
    ) {
        const privateKey = await this.getPrivateKeyInternally(from);
        const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        const account = privateKeyToAccount(normalizedPrivateKey as Hex);

        const signature = await account.signTypedData(typedData);

        return signature;
    }

    /**
     * Sends a transaction using viem wallet client
     * @param from - Address to send from
     * @param to - Address to send to
     * @param authorizationList - List of authorizations for the transaction
     * @param chain - The viem chain configuration
     * @returns Promise resolving to the transaction hash
     */
    async sendTransactionUsingViem(
        from: string,
        to: string,
        authorizationList: any[],
        chain: Chain,
    ): Promise<string> {
        const privateKey = await this.getPrivateKeyInternally(from);
        const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        const account = privateKeyToAccount(normalizedPrivateKey as Hex);

        // Create wallet client
        const userClient = createWalletClient({
            account,
            chain,
            transport: http(),
        }).extend(publicActions);

        // Send the transaction
        const txhash = await userClient.sendTransaction({
            to: to as Hex,
            authorizationList,
            chain,
        });

        return txhash;
    }

    /**
     * Signs a transaction by calling down into a specific keyring.
     *
     * @param transaction - Transaction object to sign. Must be a `ethereumjs-tx` transaction instance.
     * @param from - Address to sign from, should be in keychain.
     * @param opts - An optional options object.
     * @returns Promise resolving to a signed transaction string.
     */
    async signTransaction(
        transaction: TypedTransaction,
        from: string,
        opts?: Record<string, unknown>,
    ): Promise<TxData> {
        const address = ethNormalize(from) as Hex;
        const keyring = (await this.getKeyringForAccount(address)) as EthKeyring<Json>;
        if (!keyring.signTransaction) {
            throw new Error(KeyringControllerError.UnsupportedSignTransaction);
        }

        return await keyring.signTransaction(address, transaction, opts);
    }

    /**
     * Convert a base transaction to a base UserOperation.
     *
     * @param from - Address of the sender.
     * @param transactions - Base transactions to include in the UserOperation.
     * @param executionContext - The execution context to use for the UserOperation.
     * @returns A pseudo-UserOperation that can be used to construct a real.
     */
    async prepareUserOperation(
        from: string,
        transactions: EthBaseTransaction[],
        executionContext: KeyringExecutionContext,
    ): Promise<EthBaseUserOperation> {
        const address = ethNormalize(from) as Hex;
        const keyring = (await this.getKeyringForAccount(address)) as EthKeyring<Json>;

        if (!keyring.prepareUserOperation) {
            throw new Error(KeyringControllerError.UnsupportedPrepareUserOperation);
        }

        return await keyring.prepareUserOperation(address, transactions, executionContext);
    }

    /**
     * Patches properties of a UserOperation. Currently, only the
     * `paymasterAndData` can be patched.
     *
     * @param from - Address of the sender.
     * @param userOp - UserOperation to patch.
     * @param executionContext - The execution context to use for the UserOperation.
     * @returns A patch to apply to the UserOperation.
     */
    async patchUserOperation(
        from: string,
        userOp: EthUserOperation,
        executionContext: KeyringExecutionContext,
    ): Promise<EthUserOperationPatch> {
        const address = ethNormalize(from) as Hex;
        const keyring = (await this.getKeyringForAccount(address)) as EthKeyring<Json>;

        if (!keyring.patchUserOperation) {
            throw new Error(KeyringControllerError.UnsupportedPatchUserOperation);
        }

        return await keyring.patchUserOperation(address, userOp, executionContext);
    }

    /**
     * Signs an UserOperation.
     *
     * @param from - Address of the sender.
     * @param userOp - UserOperation to sign.
     * @param executionContext - The execution context to use for the UserOperation.
     * @returns The signature of the UserOperation.
     */
    async signUserOperation(
        from: string,
        userOp: EthUserOperation,
        executionContext: KeyringExecutionContext,
    ): Promise<string> {
        const address = ethNormalize(from) as Hex;
        const keyring = (await this.getKeyringForAccount(address)) as EthKeyring<Json>;

        if (!keyring.signUserOperation) {
            throw new Error(KeyringControllerError.UnsupportedSignUserOperation);
        }

        return await keyring.signUserOperation(address, userOp, executionContext);
    }

    /**
     * Changes the password used to encrypt the vault.
     *
     * @param password - The new password.
     * @returns Promise resolving when the operation completes.
     */
    changePassword(password: string): Promise<void> {
        return this.#persistOrRollback(async () => {
            if (!this.state.isUnlocked) {
                throw new Error(KeyringControllerError.MissingCredentials);
            }

            assertIsValidPassword(password);

            this.#password = password;
            // We need to clear encryption key and salt from state
            // to force the controller to re-encrypt the vault using
            // the new password.
            if (this.#cacheEncryptionKey) {
                this.update(state => {
                    delete state.encryptionKey;
                    delete state.encryptionSalt;
                });
            }
        });
    }

    /**
     * Attempts to decrypt the current vault and load its keyrings,
     * using the given encryption key and salt.
     *
     * @param encryptionKey - Key to unlock the keychain.
     * @param encryptionSalt - Salt to unlock the keychain.
     * @returns Promise resolving when the operation completes.
     */
    async submitEncryptionKey(encryptionKey: string, encryptionSalt: string): Promise<void> {
        return this.#withRollback(async () => {
            this.#keyrings = await this.#unlockKeyrings(undefined, encryptionKey, encryptionSalt);
            this.#setUnlocked();
        });
    }

    /**
     * Attempts to decrypt the current vault and load its keyrings,
     * using the given password.
     *
     * @param password - Password to unlock the keychain.
     * @returns Promise resolving when the operation completes.
     */
    async submitPassword(password: string): Promise<void> {
        return this.#withRollback(async () => {
            this.#keyrings = await this.#unlockKeyrings(password);
            this.#setUnlocked();
        });
    }

    /**
     * Verifies the that the seed phrase restores the current keychain's accounts.
     *
     * @param walletId - walletId of the wallet.
     * @returns Promise resolving to the seed phrase as Uint8Array.
     */
    async verifySeedPhrase(walletId: string): Promise<Uint8Array> {
        const keyring = this.getHDKeyringByWalletId(walletId);

        if (!keyring) {
            throw new Error('No HD keyring found.');
        }

        assertHasUint8ArrayMnemonic(keyring);

        const seedWords = keyring.mnemonic;
        const accounts = await keyring.getAccounts();
        /* istanbul ignore if */
        if (accounts.length === 0) {
            throw new Error('Cannot verify an empty keyring.');
        }

        // The HD Keyring Builder is a default keyring builder
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const hdKeyringBuilder = this.#getKeyringBuilderForType(KeyringTypes.hd)!;

        const hdKeyring = hdKeyringBuilder();
        // @ts-expect-error @metamask/eth-hd-keyring correctly handles
        // Uint8Array seed phrases in the `deserialize` method.
        await hdKeyring.deserialize({
            mnemonic: seedWords,
            numberOfAccounts: accounts.length,
        });
        const testAccounts = await hdKeyring.getAccounts();
        /* istanbul ignore if */
        if (testAccounts.length !== accounts.length) {
            throw new Error('Seed phrase imported incorrect number of accounts.');
        }

        testAccounts.forEach((account: string, i: number) => {
            /* istanbul ignore if */
            if (account.toLowerCase() !== accounts[i].toLowerCase()) {
                throw new Error('Seed phrase imported different accounts.');
            }
        });

        return seedWords;
    }

    /**
     * Select a keyring and execute the given operation with
     * the selected keyring, as a mutually exclusive atomic
     * operation.
     *
     * The method automatically persists changes at the end of the
     * function execution, or rolls back the changes if an error
     * is thrown.
     *
     * @param selector - Keyring selector object.
     * @param operation - Function to execute with the selected keyring.
     * @param options - Additional options.
     * @param options.createIfMissing - Whether to create a new keyring if the selected one is missing.
     * @param options.createWithData - Optional data to use when creating a new keyring.
     * @returns Promise resolving to the result of the function execution.
     * @template SelectedKeyring - The type of the selected keyring.
     * @template CallbackResult - The type of the value resolved by the callback function.
     * @deprecated This method overload is deprecated. Use `withKeyring` without options instead.
     */
    async withKeyring<
        SelectedKeyring extends EthKeyring<Json> = EthKeyring<Json>,
        CallbackResult = void,
    >(
        selector: KeyringSelector,
        operation: (keyring: SelectedKeyring) => Promise<CallbackResult>,
        // eslint-disable-next-line @typescript-eslint/unified-signatures
        options: { createIfMissing?: false } | { createIfMissing: true; createWithData?: unknown },
    ): Promise<CallbackResult>;

    /**
     * Select a keyring and execute the given operation with
     * the selected keyring, as a mutually exclusive atomic
     * operation.
     *
     * The method automatically persists changes at the end of the
     * function execution, or rolls back the changes if an error
     * is thrown.
     *
     * @param selector - Keyring selector object.
     * @param operation - Function to execute with the selected keyring.
     * @returns Promise resolving to the result of the function execution.
     * @template SelectedKeyring - The type of the selected keyring.
     * @template CallbackResult - The type of the value resolved by the callback function.
     */
    async withKeyring<
        SelectedKeyring extends EthKeyring<Json> = EthKeyring<Json>,
        CallbackResult = void,
    >(
        selector: KeyringSelector,
        operation: (keyring: SelectedKeyring) => Promise<CallbackResult>,
    ): Promise<CallbackResult>;

    async withKeyring<
        SelectedKeyring extends EthKeyring<Json> = EthKeyring<Json>,
        CallbackResult = void,
    >(
        selector: KeyringSelector,
        operation: (keyring: SelectedKeyring) => Promise<CallbackResult>,
        options:
            | { createIfMissing?: false }
            | { createIfMissing: true; createWithData?: unknown } = {
            createIfMissing: false,
        },
    ): Promise<CallbackResult> {
        return this.#persistOrRollback(async () => {
            let keyring: SelectedKeyring | undefined;

            if ('address' in selector) {
                keyring = (await this.getKeyringForAccount(selector.address)) as
                    | SelectedKeyring
                    | undefined;
            } else {
                keyring = this.getKeyringsByType(selector.type)[selector.index || 0] as
                    | SelectedKeyring
                    | undefined;

                if (!keyring && options.createIfMissing) {
                    keyring = (await this.#newKeyring(
                        selector.type,
                        options.createWithData,
                    )) as SelectedKeyring;
                }
            }

            if (!keyring) {
                throw new Error(KeyringControllerError.KeyringNotFound);
            }

            const result = await operation(keyring);

            if (Object.is(result, keyring)) {
                // Access to a keyring instance outside of controller safeguards
                // should be discouraged, as it can lead to unexpected behavior.
                // This error is thrown to prevent consumers using `withKeyring`
                // as a way to get a reference to a keyring instance.
                throw new Error(KeyringControllerError.UnsafeDirectKeyringAccess);
            }

            return result;
        });
    }

    async getAccountKeyringType(account: string): Promise<string> {
        const keyring = (await this.getKeyringForAccount(account)) as EthKeyring<Json>;
        return keyring.type;
    }

    /**
     * Constructor helper for registering this controller's messaging system
     * actions.
     */
    #registerMessageHandlers() {
        this.messagingSystem.registerActionHandler(
            `${name}:signMessage`,
            this.signMessage.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:signPersonalMessage`,
            this.signPersonalMessage.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:signTypedMessage`,
            this.signTypedMessage.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:signAuthorization`,
            this.signAuthorization.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:signTypedMessageUsingViem`,
            this.signTypedMessageUsingViem.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:sendTransactionUsingViem`,
            this.sendTransactionUsingViem.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:decryptMessage`,
            this.decryptMessage.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:getEncryptionPublicKey`,
            this.getEncryptionPublicKey.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:getAccounts`,
            this.getAccounts.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:getKeyringsByType`,
            this.getKeyringsByType.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:getHDKeyringByWalletId`,
            this.getHDKeyringByWalletId.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:getKeyringByWalletId`,
            this.getKeyringByWalletId.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:getAccountsByWalletId`,
            this.getAccountsByWalletId.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:getKeyringForAccount`,
            this.getKeyringForAccount.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:persistAllKeyrings`,
            this.persistAllKeyrings.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:prepareUserOperation`,
            this.prepareUserOperation.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:patchUserOperation`,
            this.patchUserOperation.bind(this),
        );

        this.messagingSystem.registerActionHandler(
            `${name}:signUserOperation`,
            this.signUserOperation.bind(this),
        );
    }

    /**
     * Get the keyring builder for the given `type`.
     *
     * @param type - The type of keyring to get the builder for.
     * @returns The keyring builder, or undefined if none exists.
     */
    #getKeyringBuilderForType(type: string): { (): EthKeyring<Json>; type: string } | undefined {
        return this.#keyringBuilders.find(keyringBuilder => keyringBuilder.type === type);
    }

    /**
     * Create new vault with an initial keyring
     *
     * Destroys any old encrypted storage,
     * creates a new encrypted store with the given password,
     * creates a new wallet with 1 account.
     *
     * @fires KeyringController:unlock
     * @param password - The password to encrypt the vault with.
     * @param keyring - A object containing the params to instantiate a new keyring.
     * @param keyring.type - The keyring type.
     * @param keyring.opts - Optional parameters required to instantiate the keyring.
     * @returns A promise that resolves to the state.
     */
    async #createNewVaultWithKeyring(
        password: string,
        keyring: {
            type: string;
            opts?: unknown;
        },
    ): Promise<string> {
        this.#assertControllerMutexIsLocked();

        if (typeof password !== 'string') {
            throw new TypeError(KeyringControllerError.WrongPasswordType);
        }
        this.#password = password;

        await this.#clearKeyrings();

        // if (this.#cacheEncryptionKey) {
        //     this.update(state => {
        //         state.encryptionKey = undefined;
        //         state.encryptionSalt = undefined;
        //     });
        // }

        const walletId = await this.#createKeyringWithFirstAccount(keyring.type, keyring.opts);

        this.#setUnlocked();

        return walletId;
    }

    /**
     * Get the updated array of each keyring's type and
     * accounts list.
     *
     * @returns A promise resolving to the updated keyrings array.
     */
    async #getUpdatedKeyrings(): Promise<KeyringObject[]> {
        return Promise.all(this.#keyrings.map(displayForKeyring));
    }

    /**
     * Serialize the current array of keyring instances,
     * including unsupported keyrings by default.
     *
     * @param options - Method options.
     * @param options.includeUnsupported - Whether to include unsupported keyrings.
     * @returns The serialized keyrings.
     */
    async #getSerializedKeyrings(
        { includeUnsupported }: { includeUnsupported: boolean } = {
            includeUnsupported: true,
        },
    ): Promise<SerializedKeyring[]> {
        const serializedKeyrings = await Promise.all(
            this.#keyrings.map(async keyring => {
                const [type, data] = await Promise.all([keyring.type, keyring.serialize()]);
                return { type, data };
            }),
        );

        if (includeUnsupported) {
            serializedKeyrings.push(...this.#unsupportedKeyrings);
        }

        return serializedKeyrings;
    }

    /**
     * Restore a serialized keyrings array.
     *
     * @param serializedKeyrings - The serialized keyrings array.
     */
    async #restoreSerializedKeyrings(serializedKeyrings: SerializedKeyring[]): Promise<void> {
        await this.#clearKeyrings();

        for (const serializedKeyring of serializedKeyrings) {
            await this.#restoreKeyring(serializedKeyring);
        }
    }

    /**
     * Unlock Keyrings, decrypting the vault and deserializing all
     * keyrings contained in it, using a password or an encryption key with salt.
     *
     * @param password - The keyring controller password.
     * @param encryptionKey - An exported key string to unlock keyrings with.
     * @param encryptionSalt - The salt used to encrypt the vault.
     * @returns A promise resolving to the deserialized keyrings array.
     */
    async #unlockKeyrings(
        password: string | undefined,
        encryptionKey?: string,
        encryptionSalt?: string,
    ): Promise<EthKeyring<Json>[]> {
        return this.#withVaultLock(async ({ releaseLock }) => {
            const encryptedVault = this.state.vault;
            if (!encryptedVault) {
                throw new Error(KeyringControllerError.VaultError);
            }

            let vault;
            const updatedState: Partial<KeyringControllerState> = {};

            if (this.#cacheEncryptionKey) {
                assertIsExportableKeyEncryptor(this.#encryptor);

                if (password) {
                    const result = await this.#encryptor.decryptWithDetail(
                        password,
                        encryptedVault,
                    );
                    vault = result.vault;
                    this.#password = password;

                    updatedState.encryptionKey = result.exportedKeyString;
                    updatedState.encryptionSalt = result.salt;
                } else {
                    const parsedEncryptedVault = JSON.parse(encryptedVault);

                    if (encryptionSalt !== parsedEncryptedVault.salt) {
                        throw new Error(KeyringControllerError.ExpiredCredentials);
                    }

                    if (typeof encryptionKey !== 'string') {
                        throw new TypeError(KeyringControllerError.WrongPasswordType);
                    }

                    const key = await this.#encryptor.importKey(encryptionKey);
                    vault = await this.#encryptor.decryptWithKey(key, parsedEncryptedVault);

                    // This call is required on the first call because encryptionKey
                    // is not yet inside the memStore
                    updatedState.encryptionKey = encryptionKey;
                    // we can safely assume that encryptionSalt is defined here
                    // because we compare it with the salt from the vault
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    updatedState.encryptionSalt = encryptionSalt!;
                }
            } else {
                if (typeof password !== 'string') {
                    throw new TypeError(KeyringControllerError.WrongPasswordType);
                }

                vault = await this.#encryptor.decrypt(password, encryptedVault);
                this.#password = password;
            }

            if (!isSerializedKeyringsArray(vault)) {
                throw new Error(KeyringControllerError.VaultDataError);
            }

            await this.#restoreSerializedKeyrings(vault);
            const updatedKeyrings = await this.#getUpdatedKeyrings();

            this.update(state => {
                state.keyrings = updatedKeyrings;
                if (updatedState.encryptionKey || updatedState.encryptionSalt) {
                    state.encryptionKey = updatedState.encryptionKey;
                    state.encryptionSalt = updatedState.encryptionSalt;
                }
            });

            if (
                this.#password &&
                (!this.#cacheEncryptionKey || !encryptionKey) &&
                this.#encryptor.isVaultUpdated &&
                !this.#encryptor.isVaultUpdated(encryptedVault)
            ) {
                // The lock needs to be released before persisting the keyrings
                // to avoid deadlock
                releaseLock();
                // Re-encrypt the vault with safer method if one is available
                await this.#updateVault();
            }

            return this.#keyrings;
        });
    }

    /**
     * Update the vault with the current keyrings.
     *
     * @returns A promise resolving to `true` if the operation is successful.
     */
    #updateVault(): Promise<boolean> {
        return this.#withVaultLock(async () => {
            const { encryptionKey, encryptionSalt } = this.state;

            if (!this.#password && !encryptionKey) {
                throw new Error(KeyringControllerError.MissingCredentials);
            }

            const serializedKeyrings = await this.#getSerializedKeyrings();

            if (
                !serializedKeyrings.some(
                    keyring =>
                        keyring.type === KeyringTypes.hd ||
                        keyring.type === KeyringTypes.simple ||
                        keyring.type === KeyringTypes.ledger ||
                        keyring.type === KeyringTypes.trezor,
                )
            ) {
                throw new Error(KeyringControllerError.NoPrimaryKeyring);
            }

            const updatedState: Partial<KeyringControllerState> = {};

            if (this.#cacheEncryptionKey) {
                assertIsExportableKeyEncryptor(this.#encryptor);

                if (encryptionKey) {
                    const key = await this.#encryptor.importKey(encryptionKey);
                    const vaultJSON = await this.#encryptor.encryptWithKey(key, serializedKeyrings);
                    vaultJSON.salt = encryptionSalt;
                    updatedState.vault = JSON.stringify(vaultJSON);
                } else if (this.#password) {
                    const { vault: newVault, exportedKeyString } =
                        await this.#encryptor.encryptWithDetail(this.#password, serializedKeyrings);

                    updatedState.vault = newVault;
                    updatedState.encryptionKey = exportedKeyString;
                }
            } else {
                assertIsValidPassword(this.#password);
                updatedState.vault = await this.#encryptor.encrypt(
                    this.#password,
                    serializedKeyrings,
                );
            }

            if (!updatedState.vault) {
                throw new Error(KeyringControllerError.MissingVaultData);
            }

            const updatedKeyrings = await this.#getUpdatedKeyrings();
            this.update(state => {
                state.vault = updatedState.vault;
                state.keyrings = updatedKeyrings;
                if (updatedState.encryptionKey) {
                    state.encryptionKey = updatedState.encryptionKey;
                    state.encryptionSalt = JSON.parse(updatedState.vault as string).salt;
                }
            });

            return true;
        });
    }

    /**
     * Retrieves all the accounts from keyrings instances
     * that are currently in memory.
     *
     * @returns A promise resolving to an array of accounts.
     */
    async #getAccountsFromKeyrings(): Promise<string[]> {
        const keyrings = this.#keyrings;

        const keyringArrays = await Promise.all(
            keyrings.map(async keyring => keyring.getAccounts()),
        );
        const addresses = keyringArrays.reduce((res, arr) => {
            return res.concat(arr);
        }, []);

        // Cast to `string[]` here is safe here because `addresses` has no nullish
        // values, and `normalize` returns `string` unless given a nullish value
        return addresses.map(normalize) as string[];
    }

    /**
     * Create a new keyring, ensuring that the first account is
     * also created.
     *
     * @param type - Keyring type to instantiate.
     * @param opts - Optional parameters required to instantiate the keyring.
     * @returns A promise that resolves if the operation is successful.
     */
    async #createKeyringWithFirstAccount(type: string, opts?: unknown) {
        this.#assertControllerMutexIsLocked();

        const keyring = (await this.#newKeyring(type, opts)) as EthKeyring<Json>;

        const [firstAccount] = await keyring.getAccounts();

        if (!firstAccount) {
            throw new Error(KeyringControllerError.NoFirstAccount);
        }

        // For simple or hardware keyrings there is no HD mnemonic; identify the wallet from the primary address.
        if (
            type === KeyringTypes.simple ||
            type === KeyringTypes.ledger ||
            type === KeyringTypes.trezor
        ) {
            return getUUIDFromAddress(firstAccount);
        }

        assertHasUint8ArrayMnemonic(keyring);
        return getUUIDFromMnemonic(keyring.mnemonic);
    }

    /**
     * Instantiate, initialize and return a new keyring of the given `type`,
     * using the given `opts`. The keyring is built using the keyring builder
     * registered for the given `type`.
     *
     *
     * @param type - The type of keyring to add.
     * @param data - The data to restore a previously serialized keyring.
     * @returns The new keyring.
     * @throws If the keyring includes duplicated accounts.
     */
    async #newKeyring(type: string, data?: unknown): Promise<EthKeyring<Json>> {
        this.#assertControllerMutexIsLocked();

        const keyringBuilder = this.#getKeyringBuilderForType(type);

        if (!keyringBuilder) {
            throw new Error(`${KeyringControllerError.NoKeyringBuilder}. Keyring type: ${type}`);
        }

        const keyring = keyringBuilder();

        // @ts-expect-error Enforce data type after updating clients
        await keyring.deserialize(data);

        if (keyring.init) {
            await keyring.init();
        }

        if (type === KeyringTypes.hd && (!isObject(data) || !data.mnemonic)) {
            if (!keyring.generateRandomMnemonic) {
                throw new Error(KeyringControllerError.UnsupportedGenerateRandomMnemonic);
            }

            keyring.generateRandomMnemonic();
            await keyring.addAccounts(1);
        }

        await this.#checkForDuplicate(type, await keyring.getAccounts());

        this.#keyrings.push(keyring);

        return keyring;
    }

    /**
     * Remove all managed keyrings, destroying all their
     * instances in memory.
     */
    async #clearKeyrings() {
        this.#assertControllerMutexIsLocked();
        for (const keyring of this.#keyrings) {
            await this.#destroyKeyring(keyring);
        }
        this.#keyrings = [];
    }

    /**
     * Restore a Keyring from a provided serialized payload.
     * On success, returns the resulting keyring instance.
     *
     * @param serialized - The serialized keyring.
     * @returns The deserialized keyring or undefined if the keyring type is unsupported.
     */
    async #restoreKeyring(serialized: SerializedKeyring): Promise<EthKeyring<Json> | undefined> {
        this.#assertControllerMutexIsLocked();

        try {
            const { type, data } = serialized;
            return await this.#newKeyring(type, data);
        } catch (_) {
            this.#unsupportedKeyrings.push(serialized);
            return undefined;
        }
    }

    /**
     * Destroy Keyring
     *
     * Some keyrings support a method called `destroy`, that destroys the
     * keyring along with removing all its event listeners and, in some cases,
     * clears the keyring bridge iframe from the DOM.
     *
     * @param keyring - The keyring to destroy.
     */
    async #destroyKeyring(keyring: EthKeyring<Json>) {
        await keyring.destroy?.();
    }

    /**
     * Remove empty keyrings.
     *
     * Loops through the keyrings and removes the ones with empty accounts
     * (usually after removing the last / only account) from a keyring.
     */
    async #removeEmptyKeyrings(): Promise<void> {
        this.#assertControllerMutexIsLocked();
        const validKeyrings: EthKeyring<Json>[] = [];

        // Since getAccounts returns a Promise
        // We need to wait to hear back form each keyring
        // in order to decide which ones are now valid (accounts.length > 0)

        await Promise.all(
            this.#keyrings.map(async (keyring: EthKeyring<Json>) => {
                const accounts = await keyring.getAccounts();
                if (accounts.length > 0) {
                    validKeyrings.push(keyring);
                } else {
                    await this.#destroyKeyring(keyring);
                }
            }),
        );
        this.#keyrings = validKeyrings;
    }

    /**
     * Checks for duplicate keypairs, using the the first account in the given
     * array. Rejects if a duplicate is found.
     *
     * Only supports avoiding duplicate addresses for 'Simple Key Pair', 'Ledger Hardware', and 'Trezor Hardware'.
     *
     * @param type - The key pair type to check for.
     * @param newAccountArray - Array of new accounts.
     * @returns The account, if no duplicate is found.
     */
    async #checkForDuplicate(type: string, newAccountArray: string[]): Promise<string[]> {
        const accounts = await this.#getAccountsFromKeyrings();

        switch (type) {
            case KeyringTypes.simple:
            case KeyringTypes.ledger:
            case KeyringTypes.trezor: {
                const isIncluded = Boolean(
                    accounts.find(
                        key =>
                            newAccountArray[0] &&
                            (key === newAccountArray[0] || key === remove0x(newAccountArray[0])),
                    ),
                );

                if (isIncluded) {
                    throw new Error(
                        type === KeyringTypes.simple
                            ? KeyringControllerError.DuplicatedSimpleAccount
                            : KeyringControllerError.DuplicatedAccount,
                    );
                }
                return newAccountArray;
            }

            default: {
                return newAccountArray;
            }
        }
    }

    /**
     * Set the `isUnlocked` to true and notify listeners
     * through the messenger.
     *
     * @fires KeyringController:unlock
     */
    #setUnlocked(): void {
        this.#assertControllerMutexIsLocked();

        this.update(state => {
            state.isUnlocked = true;
        });
        this.messagingSystem.publish(`${name}:unlock`);
    }

    /**
     * Execute the given function after acquiring the controller lock
     * and save the keyrings to state after it, or rollback to their
     * previous state in case of error.
     *
     * @param fn - The function to execute.
     * @returns The result of the function.
     */
    async #persistOrRollback<T>(fn: MutuallyExclusiveCallback<T>): Promise<T> {
        return this.#withRollback(async ({ releaseLock }) => {
            const callbackResult = await fn({ releaseLock });
            // State is committed only if the operation is successful
            await this.#updateVault();

            return callbackResult;
        });
    }

    /**
     * Execute the given function after acquiring the controller lock
     * and rollback keyrings and password states in case of error.
     *
     * @param fn - The function to execute atomically.
     * @returns The result of the function.
     */
    async #withRollback<T>(fn: MutuallyExclusiveCallback<T>): Promise<T> {
        return this.#withControllerLock(async ({ releaseLock }) => {
            const currentSerializedKeyrings = await this.#getSerializedKeyrings();
            const currentPassword = this.#password;

            try {
                return await fn({ releaseLock });
            } catch (e) {
                // Keyrings and password are restored to their previous state
                await this.#restoreSerializedKeyrings(currentSerializedKeyrings);
                this.#password = currentPassword;

                throw e;
            }
        });
    }

    /**
     * Assert that the controller mutex is locked.
     *
     * @throws If the controller mutex is not locked.
     */
    #assertControllerMutexIsLocked() {
        if (!this.#controllerOperationMutex.isLocked()) {
            throw new Error(KeyringControllerError.ControllerLockRequired);
        }
    }

    /**
     * Lock the controller mutex before executing the given function,
     * and release it after the function is resolved or after an
     * error is thrown.
     *
     * This wrapper ensures that each mutable operation that interacts with the
     * controller and that changes its state is executed in a mutually exclusive way,
     * preventing unsafe concurrent access that could lead to unpredictable behavior.
     *
     * @param fn - The function to execute while the controller mutex is locked.
     * @returns The result of the function.
     */
    async #withControllerLock<T>(fn: MutuallyExclusiveCallback<T>): Promise<T> {
        return withLock(this.#controllerOperationMutex, fn);
    }

    /**
     * Lock the vault mutex before executing the given function,
     * and release it after the function is resolved or after an
     * error is thrown.
     *
     * This ensures that each operation that interacts with the vault
     * is executed in a mutually exclusive way.
     *
     * @param fn - The function to execute while the vault mutex is locked.
     * @returns The result of the function.
     */
    async #withVaultLock<T>(fn: MutuallyExclusiveCallback<T>): Promise<T> {
        this.#assertControllerMutexIsLocked();

        return withLock(this.#vaultOperationMutex, fn);
    }
}

/**
 * Lock the given mutex before executing the given function,
 * and release it after the function is resolved or after an
 * error is thrown.
 *
 * @param mutex - The mutex to lock.
 * @param fn - The function to execute while the mutex is locked.
 * @returns The result of the function.
 */
export async function withLock<T>(mutex: Mutex, fn: MutuallyExclusiveCallback<T>): Promise<T> {
    const releaseLock = await mutex.acquire();

    try {
        return await fn({ releaseLock });
    } finally {
        releaseLock();
    }
}

export default KeyringController;
