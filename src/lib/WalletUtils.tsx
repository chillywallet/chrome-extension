import { isHexPrefixed, toBuffer } from '@ethereumjs/util';
import { getDecimalPlaces } from '../shared/utils/format';
import BigNumber from 'bignumber.js';
import { sha256 } from 'ethereum-cryptography/sha256';
import { ethers } from 'ethers';
import { v4 as uuid } from 'uuid';
import { EVM_NATIVE_TOKEN_ADDRESS } from '../shared/constants/network';
import { Chain, GasPriceType } from '../shared/types/Chain';
import {
    GasInfo,
    GasOptionsData,
    GasType,
    HandledGasData,
    PlatformCoin,
} from '../shared/types/Wallet';
import logger from '../shared/utils/logger';
import { isEqualCaseInsensitive } from '../shared/utils/string';
import { getCurrentChainByChain, getCurrentChainByPlatformId } from './ChainsUtils';
import { toHex } from './web3';

export function sanitizeSeedPhrase(string: string): string {
    // trim extraneous whitespaces + remove new lines / line breaks
    return string
        .replace(/(\r\n|\n|\r)/gm, ' ')
        .trim()
        .split(' ')
        .filter((word: string) => !!word)
        .join(' ');
}

export function handleGasPrice(
    gasOptionsData: GasOptionsData | undefined,
    currentGasType: GasType,
    customGas: GasInfo | undefined,
    gasPriceType: GasPriceType,
    suggestGas?: GasInfo,
): HandledGasData {
    if (gasPriceType === GasPriceType.BaseAndPriority) {
        let priorityFee = 0n;
        let maxFeePerGas = 0n;
        let baseFee = 0n;

        if (currentGasType === GasType.Suggest && suggestGas?.maxFeePerGas && suggestGas?.baseFee) {
            priorityFee = suggestGas.priorityFee ?? 0n;
            maxFeePerGas = suggestGas.maxFeePerGas;
            baseFee = suggestGas.baseFee;
        } else if (
            currentGasType === GasType.Custom &&
            customGas?.maxFeePerGas &&
            customGas?.baseFee
        ) {
            priorityFee = customGas.priorityFee ?? 0n;
            maxFeePerGas = customGas.maxFeePerGas;
            baseFee = customGas.baseFee;
        } else if (gasOptionsData) {
            const gasOption =
                currentGasType === GasType.Low
                    ? gasOptionsData.low
                    : currentGasType === GasType.High
                      ? gasOptionsData.high
                      : gasOptionsData.medium;

            priorityFee = gasOption?.priorityFee ?? 0n;
            baseFee = gasOption?.baseFee ?? 0n;
            maxFeePerGas = gasOption?.maxFeePerGas ?? 0n;
        }

        return {
            gasInfo: { priorityFee, baseFee, maxFeePerGas },
            gasPrice: maxFeePerGas,
        };
    } else {
        let gasPrice = 0n;

        if (currentGasType === GasType.Suggest && suggestGas?.gasPrice) {
            gasPrice = suggestGas.gasPrice;
        } else if (currentGasType === GasType.Custom && customGas?.gasPrice) {
            gasPrice = customGas.gasPrice;
        } else if (gasOptionsData) {
            const gasOption =
                currentGasType === GasType.Low
                    ? gasOptionsData.low
                    : currentGasType === GasType.High
                      ? gasOptionsData.high
                      : gasOptionsData.medium;

            gasPrice = gasOption?.gasPrice ?? 0n;
        }

        return {
            gasInfo: { gasPrice },
            gasPrice,
        };
    }
}

export function isNativeCoinBySymbol(chain: Chain, symbol?: string) {
    const currentChain = getCurrentChainByChain(chain);

    if (currentChain) {
        return currentChain.native_coin_symbol === symbol;
    }

    return false;
}

export function isNativeCoinByPlatformId(platformId: number, symbol?: string) {
    const currentChain = getCurrentChainByPlatformId(platformId);

    if (currentChain) {
        return currentChain.native_coin_symbol === symbol;
    }

    return false;
}

export function isNativeCoinByPlatformIdAndTokenAddress(platformId: number, tokenAddress: string) {
    if (isEqualCaseInsensitive(tokenAddress, EVM_NATIVE_TOKEN_ADDRESS)) return true;

    try {
        const currentChain = getCurrentChainByPlatformId(platformId);

        if (currentChain) {
            return isEqualCaseInsensitive(currentChain.native_coin_address, tokenAddress);
        }
    } catch (error: any) {
        logger.log('isNativeCoinByPlatformIdAndTokenAddress', error?.message);
        return false;
    }

    return false;
}

export function isNativeCoinByTokenAddress(chain: Chain, tokenAddress?: string | null) {
    if (tokenAddress && isEqualCaseInsensitive(tokenAddress, EVM_NATIVE_TOKEN_ADDRESS)) return true;

    try {
        const currentChain = getCurrentChainByChain(chain);

        if (currentChain) {
            return currentChain.native_coin_address.toLowerCase() === tokenAddress?.toLowerCase();
        }
    } catch (error: any) {
        logger.log('isNativeCoinByPlatformIdAndTokenAddress', error?.message);
        return false;
    }

    return false;
}

export function getNativeSymbol(chain: Chain) {
    const currentChain = getCurrentChainByChain(chain);

    if (currentChain) {
        return currentChain.native_coin_symbol;
    }

    return 'ETH';
}

export function getGasData(gasInfo: GasInfo) {
    if (gasInfo.maxFeePerGas) {
        logger.log('⛽ Gas Data', {
            maxFeePerGas: gasInfo.maxFeePerGas,
            maxPriorityFeePerGas: gasInfo.priorityFee,
            type: 2,
        });

        return {
            maxFeePerGas: toHex(gasInfo.maxFeePerGas),
            maxPriorityFeePerGas: toHex(gasInfo.priorityFee ?? 0n),
            type: 2,
        };
    } else if (gasInfo.gasPrice) {
        logger.log('⛽ Gas Data', {
            gasPrice: gasInfo.gasPrice,
            type: 1,
        });

        return { gasPrice: toHex(gasInfo.gasPrice), type: 1 };
    } else {
        throw new Error('gasInfo is incorrect');
    }
}

/**
 * Safely format a number to a fixed number of decimals.
 *
 * Features:
 * - Floor rounding (never rounds up)
 * - Prevents scientific notation (e.g., 7.09e-16 → 0.000000000000000709)
 * - Locale-safe (handles comma input)
 * - Optional trimming of trailing zeros
 * - Handles 0 correctly
 * - Clamps decimals to JavaScript's safe range (0–20)
 *
 * @param value       Number or string to format
 * @param decimals    Number of decimal places (default 6)
 * @param trimZeros   If true, trims trailing zeros and final dot (default true)
 * @returns           Formatted string (non-scientific, floor-rounded)
 */
export const formatSafeFixed = (
    value: number | string,
    decimals: number = 6,
    trimZeros: boolean = true,
): string => {
    // --- Clamp decimals to safe range (0–20) ---
    decimals = Math.max(0, Math.min(20, Math.floor(decimals)));

    // --- Handle invalid or empty inputs ---
    if (
        value === null ||
        value === undefined ||
        value === '' ||
        (typeof value === 'string' && value.trim() === '')
    ) {
        return '0';
    }

    // --- Normalize input (handle commas) ---
    const normalized = String(value).replace(',', '.');

    // --- Create BigNumber safely ---
    const bn = new BigNumber(normalized);
    if (!bn.isFinite() || bn.isNaN()) return '0';

    // --- Handle zero explicitly ---
    if (bn.isZero()) return '0';

    // --- Floor rounding ---
    const floored = bn.decimalPlaces(decimals, BigNumber.ROUND_FLOOR);

    // --- Convert to string with fixed decimals ---
    let result = floored.toFixed(decimals);

    // --- Optional trimming of trailing zeros ---
    if (trimZeros) {
        result = result.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
    }

    return result;
};

export const safeParseUnits = (value: number | string, decimals: number = 18) => {
    try {
        const safeNumber = formatSafeFixed(value, decimals);
        return ethers.parseUnits(safeNumber, decimals);
    } catch (error: any) {
        logger.log('WalletUtils', 'parseUnits', error?.message, value, decimals);
        return BigInt(0);
    }
};

export const toSafeFixed = (value: number | string, decimals?: number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const decimalPlaces = getDecimalPlaces(num);

    const roundedNum =
        typeof decimals === 'number'
            ? decimalPlaces < decimals
                ? decimalPlaces
                : decimals
            : decimalPlaces;
    return num.toFixed(roundedNum);
};

export function stripHexPrefix(str: string) {
    if (typeof str !== 'string') {
        return str;
    }
    return isHexPrefixed(str) ? str.slice(2) : str;
}

export const hexToText = (hex: string) => {
    if (!hex) {
        return hex;
    }
    try {
        const stripped = stripHexPrefix(hex);
        const buff = Buffer.from(stripped, 'hex');
        return buff.length === 32 ? hex : buff.toString('utf8');
    } catch (e) {
        return hex;
    }
};

export const getSwapTokenAddress = (coin: PlatformCoin | null, chain: Chain) => {
    if (coin?.coinAddress) {
        return coin.coinAddress;
    }

    const currentChain = getCurrentChainByChain(chain);

    return currentChain &&
        (coin?.symbol === currentChain.native_coin_symbol ||
            (currentChain.chain_key === 'polygon' && coin?.symbol === 'MATIC'))
        ? currentChain.native_coin_address
        : null;
};

/**
 * @desc Can omit only flattened key, will not work with nested props like 'key.someObj.value'
 */
export const omitFlatten = <T extends object, K extends keyof T>(
    obj: T | null | undefined,
    keys: K[] | K,
): Omit<T, K> => {
    const keysArr = Array.isArray(keys) ? keys : [keys];
    const newObj: any = {};
    const keysArrObj: any = {};
    for (const key of keysArr) {
        keysArrObj[key] = true;
    }
    for (const key in obj) {
        if (!keysArrObj[key]) newObj[key] = obj[key];
    }
    return newObj;
};

function indexOfClosingBrace(slice: string, openIndex: number): number {
    let depth = 0;
    for (let i = openIndex; i < slice.length; i++) {
        const c = slice[i];
        if (c === '{') {
            depth++;
        } else if (c === '}') {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

/**
 * Parses nested `error={ "message": "..." }` from ethers-style RPC wrapper strings.
 */
function extractWrappedJsonRpcMessageFromString(raw: string): string | undefined {
    if (!raw || typeof raw !== 'string') {
        return undefined;
    }

    const marker = /\berror\s*=\s*\{/i.exec(raw);
    if (!marker) {
        return undefined;
    }

    const braceOpen = marker.index + marker[0].length - 1;
    const braceClose = indexOfClosingBrace(raw, braceOpen);
    if (braceClose < 0) {
        return undefined;
    }

    const jsonSlice = raw.slice(braceOpen, braceClose + 1);
    try {
        const parsed = JSON.parse(jsonSlice) as { message?: unknown };
        if (typeof parsed.message === 'string' && parsed.message.trim()) {
            return parsed.message.trim();
        }
    } catch {
        const msgMatch = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/i.exec(jsonSlice);
        if (msgMatch?.[1]) {
            return msgMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
    }

    return undefined;
}

function parseJsonRpcErrorBody(body: unknown): string | undefined {
    if (typeof body !== 'string') {
        return undefined;
    }
    try {
        const errorJson = JSON.parse(body) as { error?: { message?: unknown } };
        if (typeof errorJson?.error?.message === 'string' && errorJson.error.message.trim()) {
            return errorJson.error.message.trim();
        }
    } catch {
        /* ignore */
    }
    return undefined;
}

export const getTransactionErrorMessage = (error: unknown): string => {
    if (error === undefined || error === null) {
        return 'Unknown Error';
    }

    const visited = new Set<unknown>();
    let cursor: unknown = error;

    for (let depth = 0; depth < 12 && cursor != null && !visited.has(cursor); depth++) {
        visited.add(cursor);
        const er = cursor as Record<string, unknown>;

        let extracted = parseJsonRpcErrorBody(er.body);
        if (extracted) {
            return extracted;
        }

        const dataObj = er.data as Record<string, unknown> | undefined;
        if (dataObj) {
            const orig = dataObj.originalError as Record<string, unknown> | undefined;
            extracted = parseJsonRpcErrorBody(orig?.body);
            if (extracted) {
                return extracted;
            }
        }

        const info = er.info as Record<string, unknown> | undefined;
        if (info) {
            const infoErr = info.error as Record<string, unknown> | undefined;
            if (typeof infoErr?.message === 'string' && infoErr.message.trim()) {
                return infoErr.message.trim();
            }
        }

        if (typeof er.message === 'string' && er.message.trim()) {
            extracted = extractWrappedJsonRpcMessageFromString(er.message);
            if (extracted) {
                return extracted;
            }
        }

        if (typeof er.shortMessage === 'string' && er.shortMessage.trim()) {
            extracted = extractWrappedJsonRpcMessageFromString(er.shortMessage);
            if (extracted) {
                return extracted;
            }
        }

        if (typeof er.reason === 'string' && er.reason.trim()) {
            extracted = extractWrappedJsonRpcMessageFromString(er.reason);
            if (extracted) {
                return extracted;
            }
            return er.reason.trim();
        }

        const innerErr = er.error as Record<string, unknown> | undefined;
        if (typeof innerErr?.message === 'string' && innerErr.message.trim()) {
            return innerErr.message.trim();
        }

        cursor = typeof er.cause !== 'undefined' && er.cause !== null ? er.cause : undefined;
    }

    const e = error as Record<string, unknown>;
    if (typeof e.shortMessage === 'string' && e.shortMessage.trim()) {
        const s = e.shortMessage.trim();
        const fromShort = extractWrappedJsonRpcMessageFromString(s);
        if (fromShort) {
            return fromShort;
        }
        if (!s.startsWith('could not coalesce')) {
            return s;
        }
    }

    if (typeof e.message === 'string' && e.message.trim()) {
        const m = e.message.trim();
        const unwrapped = extractWrappedJsonRpcMessageFromString(m);
        if (unwrapped) {
            return unwrapped;
        }
        if (!m.startsWith('could not coalesce')) {
            return m;
        }
    }

    return 'Unknown Error';
};

export async function retryFunc<T>(
    func: () => Promise<T>,
    opts?: { count: number; delay: number },
) {
    const { count, delay } = opts ?? { count: 3, delay: 0 };
    try {
        return await func();
    } catch (error) {
        if (count > 0) {
            if (delay > 0) {
                await new Promise<void>(resolve => setTimeout(() => resolve(), delay));
            }

            logger.log('retryFunc', count);
            return await retryFunc(func, { count: count - 1, delay });
        }

        throw error;
    }
}


/**
 * Generates a UUID v4 options from a given mnemonic.
 * @param address - The Ethereum address to generate the UUID from.
 * @returns The UUID v4 options.
 */
export function getUUIDOptionsFromMnemonic(mnemonic: Uint8Array) {
    const v4options = {
        random: sha256(mnemonic).slice(0, 16),
    };

    return v4options;
}

/**
 * Generates a UUID from a given Ethereum address.
 * @param address - The Ethereum address to generate the UUID from.
 * @returns The generated UUID.
 */
export function getUUIDFromMnemonic(mnemonic: Uint8Array): string {
    return uuid(getUUIDOptionsFromMnemonic(mnemonic));
}

/**
 * Generates a UUID v4 options from a given Ethereum address.
 * @param address - The Ethereum address to generate the UUID from.
 * @returns The UUID v4 options.
 */
export function getUUIDOptionsFromAddress(address: string) {
    const v4options = {
        random: sha256(new Uint8Array(toBuffer(address))).slice(0, 16),
    };

    return v4options;
}

/**
 * Generates a UUID from a given Ethereum address.
 * @param address - The Ethereum address to generate the UUID from.
 * @returns The generated UUID.
 */
export function getUUIDFromAddress(address: string): string {
    return uuid(getUUIDOptionsFromAddress(address));
}
