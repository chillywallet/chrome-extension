import { getAddress, isAddress } from 'viem';
import { getCurrentChains } from '../ChainsUtils';
import { toHex } from '../web3';

const BATCH_CALLS_CONTRACTS: Record<number, string> = {
    143: '0xbd2C0dc6521CD25A8bb3943f50B5Eec7A9d9a8a2',
    8453: '0xbd2C0dc6521CD25A8bb3943f50B5Eec7A9d9a8a2',
};

export function getSupportedChainIds(): number[] {
    return getCurrentChains().map(chain => chain.chain_id);
}

export function getBatchCallsContractAddress(chainId: number): string | undefined {
    return BATCH_CALLS_CONTRACTS[chainId];
}

export function buildEip5792CapabilitiesForChain(
    chainIdNum: number,
): Record<string, unknown> | null {
    if (!getSupportedChainIds().includes(chainIdNum)) {
        return null;
    }

    const atomicSupported = !!getBatchCallsContractAddress(chainIdNum);

    return {
        atomic: {
            status: atomicSupported ? ('supported' as const) : ('unsupported' as const),
        },
        sendCalls: {
            supported: true,
        },
    };
}

export type ParsedWalletGetCapabilities =
    | { ok: true; address?: `0x${string}`; chainIdsHex: string[] }
    | { ok: false; message: string };

export function parseWalletGetCapabilitiesParams(params: unknown): ParsedWalletGetCapabilities {
    if (!Array.isArray(params) || params.length === 0) {
        return { ok: false, message: 'Invalid params' };
    }

    const rawAddr = params[0];
    let address: `0x${string}` | undefined;
    if (rawAddr !== undefined && rawAddr !== null && rawAddr !== '') {
        if (typeof rawAddr !== 'string' || !isAddress(rawAddr)) {
            return { ok: false, message: 'Invalid params: address' };
        }
        address = getAddress(rawAddr as `0x${string}`);
    }

    const rawChains = params[1];
    const chainIdsHex: string[] = [];
    if (Array.isArray(rawChains)) {
        for (const chainId of rawChains) {
            if (typeof chainId === 'string' && chainId.startsWith('0x')) {
                const parsed = parseInt(chainId, 16);
                if (Number.isFinite(parsed) && parsed > 0) {
                    chainIdsHex.push(toHex(parsed));
                }
            }
        }
    }

    return { ok: true, address, chainIdsHex };
}

export function isCapabilitiesAddressAuthorized(
    requested: `0x${string}` | undefined,
    connectedLowercase: string[],
): boolean {
    if (!requested) {
        return true;
    }
    return connectedLowercase.includes(requested.toLowerCase());
}
