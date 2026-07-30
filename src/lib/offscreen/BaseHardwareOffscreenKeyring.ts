import type { TxData, TypedTransaction } from '@ethereumjs/tx';
import type { EthKeyring } from '@metamask/keyring-api';
import type { Hex, Json } from '@metamask/utils';
import { getAddress } from 'ethers';

import type { HardwareOffscreenRpcFn } from './hardwareOffscreenRpcTypes';
import { hardwareTxWireFromTyped, typedTransactionFromHardwareSignedWire } from './hardwareTxWire';

export type HardwareAddressPageRow = { address: string; index: number };

type HardwareOffscreenKeyringDeps<TState extends Record<string, Json>> = {
    rpc: HardwareOffscreenRpcFn;
    mergeSerialized: (previous: TState, fromBridge: TState) => TState;
    applyDiscoveryFromRows: (data: TState, rows: readonly HardwareAddressPageRow[]) => void;
    removeAuxiliaryMapsForChecksum: (data: TState, checksumAddress: string) => void;
};

/** Shared worker-side keyring behaviour for MV3 offscreen hardware (Ledger + Trezor). */
export abstract class BaseHardwareOffscreenKeyring<
    TState extends Record<string, Json>,
> implements EthKeyring<Json> {
    abstract readonly type: string;

    readonly #instanceId = crypto.randomUUID();
    #data: TState;
    readonly #deps: HardwareOffscreenKeyringDeps<TState>;

    protected constructor(initial: TState, deps: HardwareOffscreenKeyringDeps<TState>) {
        this.#data = structuredClone(initial);
        this.#deps = deps;
    }

    protected abstract emptySerialized(): TState;

    #clone(): TState {
        return structuredClone(this.#data);
    }

    #applySerialized(fromBridge: TState) {
        this.#data = this.#deps.mergeSerialized(this.#data, fromBridge);
    }

    async init(): Promise<void> {
        /** Offscreen iframe is spawned on first hardware RPC. */
    }

    async destroy(): Promise<void> {
        try {
            await this.#deps.rpc(this.#instanceId, 'dispose');
        } catch {
            // Port may already be gone after extension reload.
        }
    }

    async serialize(): Promise<Json> {
        return structuredClone(this.#data) as Json;
    }

    async deserialize(state: Json | unknown): Promise<void> {
        if (state && typeof state === 'object' && !Array.isArray(state)) {
            this.#data = structuredClone(state) as TState;
            return;
        }
        this.#data = this.emptySerialized();
    }

    async getAccounts(): Promise<Hex[]> {
        const rec = this.#data as Record<string, Json>;
        const accounts = rec.accounts;
        return Array.isArray(accounts) ? ((accounts as string[]).slice() as Hex[]) : ([] as Hex[]);
    }

    async addAccounts(number: number): Promise<Hex[]> {
        const { serialized, newAddresses } = await this.#deps.rpc<{
            serialized: TState;
            newAddresses: string[];
        }>(this.#instanceId, 'addAccounts', {
            serialized: this.#clone(),
            n: number,
        });

        this.#applySerialized(serialized);

        return newAddresses.map(address => address as Hex);
    }

    async removeAccount(address: string): Promise<void> {
        const raw = address.trim();
        const recData = this.#data as Record<string, Json>;
        const accounts = recData.accounts;

        if (!Array.isArray(accounts)) {
            throw new Error(`Address ${address} not found in this keyring`);
        }

        const list = accounts as string[];
        const lower = raw.toLowerCase();
        const filtered = list.filter(a => typeof a === 'string' && a.toLowerCase() !== lower);
        if (filtered.length === list.length) {
            throw new Error(`Address ${address} not found in this keyring`);
        }

        recData.accounts = filtered as unknown as Json;

        const checksum = getAddress(raw);
        this.#deps.removeAuxiliaryMapsForChecksum(this.#data, checksum);
    }

    async signTransaction(
        address: Hex,
        transaction: TypedTransaction,
        _opts?: Record<string, unknown>,
    ): Promise<TxData> {
        const wire = hardwareTxWireFromTyped(transaction);

        const { serialized, signedTx } = await this.#deps.rpc<{
            serialized: TState;
            signedTx: TxData;
        }>(this.#instanceId, 'signTransaction', {
            serialized: this.#clone(),
            address,
            wire,
        });

        this.#applySerialized(serialized);

        return typedTransactionFromHardwareSignedWire(
            transaction,
            signedTx as TypedTransaction | TxData | Record<string, Json | undefined>,
        ) as TxData;
    }

    async signPersonalMessage(withAccount: Hex, messageHex: Hex): Promise<Hex> {
        const { serialized, signature } = await this.#deps.rpc<{
            serialized: TState;
            signature: Hex;
        }>(this.#instanceId, 'signPersonalMessage', {
            serialized: this.#clone(),
            address: withAccount,
            message: messageHex,
        });

        this.#applySerialized(serialized);

        return signature;
    }

    async signTypedData(withAccount: Hex, typedData: unknown, opts?: { version?: unknown }) {
        const version = opts?.version;
        const versionLabel = typeof version === 'string' ? version : `${version}`;
        const { serialized, signature } = await this.#deps.rpc<{
            serialized: TState;
            signature: string;
        }>(this.#instanceId, 'signTypedData', {
            serialized: this.#clone(),
            address: withAccount,
            data: typedData,
            version: versionLabel,
        });

        this.#applySerialized(serialized);

        return signature;
    }

    async signMessage(address: Hex, data: Hex) {
        return this.signPersonalMessage(address, data);
    }

    async getAddressPage(
        direction: 'first' | 'next' | 'prev',
    ): Promise<{ address: string; index: number }[]> {
        const { serialized, accounts } = await this.#deps.rpc<{
            serialized: TState;
            accounts: { address: string; index: number; balance?: null }[];
        }>(this.#instanceId, 'getAddressPage', {
            serialized: this.#clone(),
            direction,
        });

        this.#applySerialized(serialized);

        const rows = accounts.map(({ address, index }) => ({
            address,
            index,
        }));
        this.#deps.applyDiscoveryFromRows(this.#data, rows);

        return rows;
    }

    #buildIndexToChecksumPathsMap(): Map<number, string> | null {
        const rec = this.#data as Record<string, Json>;
        const pathsRaw = rec.paths;
        if (!pathsRaw || typeof pathsRaw !== 'object' || Array.isArray(pathsRaw)) {
            return null;
        }

        const pathsObj = pathsRaw as Record<string, Json>;
        const indexToChecksum = new Map<number, string>();
        for (const [addrKey, idxVal] of Object.entries(pathsObj)) {
            const idx =
                typeof idxVal === 'number'
                    ? idxVal
                    : typeof idxVal === 'string'
                      ? Number.parseInt(idxVal, 10)
                      : Number.NaN;
            if (!Number.isFinite(idx) || typeof addrKey !== 'string' || !addrKey.startsWith('0x')) {
                continue;
            }
            if (!indexToChecksum.has(idx)) {
                indexToChecksum.set(idx, addrKey);
            }
        }

        return indexToChecksum.size > 0 ? indexToChecksum : null;
    }

    #tryImportAccountsAtIndicesLocally(sortedUniqueIndices: number[]): string[] | null {
        if (sortedUniqueIndices.length === 0) {
            return [];
        }

        const indexToChecksum = this.#buildIndexToChecksumPathsMap();
        if (!indexToChecksum) {
            return null;
        }

        const rec = this.#data as Record<string, Json>;
        const accounts = rec.accounts;
        if (!Array.isArray(accounts)) {
            return null;
        }

        const nextList = [...(accounts as string[])];
        const seenLower = new Set(nextList.map(a => String(a).toLowerCase()));
        const newAddresses: string[] = [];

        for (const idx of sortedUniqueIndices) {
            const addr = indexToChecksum.get(idx);
            if (!addr) {
                return null;
            }
            const lowered = addr.trim().toLowerCase();
            if (!seenLower.has(lowered)) {
                let checksumAddr: string;
                try {
                    checksumAddr = getAddress(addr.trim());
                } catch {
                    return null;
                }
                nextList.push(checksumAddr);
                seenLower.add(lowered);
                newAddresses.push(checksumAddr);
            }
        }

        rec.accounts = nextList as unknown as Json;
        rec.page = 0 as Json;
        rec.unlockedAccount = sortedUniqueIndices[
            sortedUniqueIndices.length - 1
        ] as unknown as Json;

        return newAddresses;
    }

    async importAccountsAtIndices(indices: number[]): Promise<string[]> {
        const sortedUniqueIndices = [...new Set(indices)].sort((a, b) => a - b);
        const local = this.#tryImportAccountsAtIndicesLocally(sortedUniqueIndices);

        if (local !== null) {
            return local;
        }

        const { serialized, newAddresses } = await this.#deps.rpc<{
            serialized: TState;
            newAddresses: string[];
        }>(this.#instanceId, 'importAccountsAtIndices', {
            serialized: this.#clone(),
            indices: sortedUniqueIndices,
        });

        this.#applySerialized(serialized);

        return newAddresses;
    }
}
