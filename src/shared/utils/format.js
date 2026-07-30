/**
 * Number/date/address formatting helpers.
 *
 * Vendored verbatim from the upstream string-utils package v1.0.6 (MIT) when the wallet
 * dropped its last external Chilly-lineage dependency. CommonJS on purpose - this
 * is compiled output; treat as a library, not app code.
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNumberDecimalPlaces = exports.getDecimalPlaces = exports.getCurrencyDecimalPlaces = exports.formatWalletAddress = exports.convertTimestampToDateIfNeeds = exports.toDayOfWeek = exports.toLocaleDateTimeString = exports.toLocaleTimeString = exports.toLocaleDateString = exports.getCurrencySymbol = exports.formatMoney = exports.formatNumber = void 0;
exports.setLogger = setLogger;
exports.getLogger = getLogger;
exports.isEqualCaseInsensitive = isEqualCaseInsensitive;
const lodash_1 = require("lodash");
const moment_1 = __importDefault(require("moment"));
let logger = {
    log: (message, ...optionalParams) => {
        if (optionalParams && optionalParams.length) {
            console.log(message + ':', ...optionalParams);
        }
        else {
            console.log(message);
        }
    },
};
/**
 * Set custom logger
 * @param customLogger Logger object with log method
 */
function setLogger(customLogger) {
    logger = customLogger;
}
/**
 * Get the current logger (for testing purposes)
 * @returns The current logger instance
 */
function getLogger() {
    return logger;
}
const getDecimalPlaces = (number) => {
    if (!Number.isFinite(number))
        return 0; // Handle non-finite numbers
    // Convert the number to a fixed precision to avoid exponential notation
    const numberString = number.toString().includes('e')
        ? number.toFixed(20).replace(/0+$/, '') // Remove trailing zeros
        : number.toString();
    const decimalPart = numberString.includes(',')
        ? numberString.split(',')[1]
        : numberString.split('.')[1];
    return decimalPart ? decimalPart.length : 0;
};
exports.getDecimalPlaces = getDecimalPlaces;
const getNumberDecimalPlaces = (number, locale = 'en-US') => {
    if (typeof number === 'undefined' || number === null) {
        return 2;
    }
    if (number < 1) {
        try {
            const tokens = number.toExponential(4).toString().split('e-');
            if (tokens.length === 2) {
                const exponential = parseInt(tokens[1], 10);
                if (exponential > 18) {
                    return 2;
                }
                if (exponential > 3) {
                    return exponential + 3;
                }
            }
        }
        catch (error) {
            logger.log('number: ' + number, error.message);
        }
    }
    else {
        if (locale === 'en-US') {
            try {
                const tokens = number.toExponential(6).toString().split('e');
                if (tokens.length === 2) {
                    const exponential = parseInt(tokens[1], 10);
                    if (exponential >= 15) {
                        const newValue = parseFloat(tokens[0]) * Math.pow(10, exponential - 15);
                        return { value: newValue, suffix: 'Quadrillion' };
                    }
                    else if (exponential >= 12) {
                        const newValue = parseFloat(tokens[0]) * Math.pow(10, exponential - 12);
                        return { value: newValue, suffix: 'Trillion' };
                    }
                    else if (exponential >= 9) {
                        const newValue = parseFloat(tokens[0]) * Math.pow(10, exponential - 9);
                        return { value: newValue, suffix: 'Billion' };
                    }
                    else if (exponential >= 6) {
                        const newValue = parseFloat(tokens[0]) * Math.pow(10, exponential - 6);
                        return { value: newValue, suffix: 'Million' };
                    }
                }
            }
            catch (error) {
                logger.log('number: ' + number, error.message);
            }
        }
        if (number > 9999) {
            return 2;
        }
        else if (number > 999) {
            return 3;
        }
        else if (number > 99) {
            return 4;
        }
        else if (number > 9) {
            return 5;
        }
    }
    return 6;
};
exports.getNumberDecimalPlaces = getNumberDecimalPlaces;
const getCurrencyDecimalPlaces = (number, locale = 'en-US') => {
    if (typeof number === 'undefined' || number === null) {
        return 2;
    }
    if (number < 1) {
        try {
            const tokens = number.toExponential(4).toString().split('e-');
            if (tokens.length === 2) {
                const exponential = parseInt(tokens[1], 10);
                if (exponential >= 18) {
                    return 2;
                }
                return exponential + 2;
            }
        }
        catch (error) {
            logger.log('number: ' + number, error.message);
        }
    }
    else {
        if (locale === 'en-US') {
            try {
                const tokens = number.toExponential(6).toString().split('e');
                if (tokens.length === 2) {
                    const exponential = parseInt(tokens[1], 10);
                    if (exponential >= 15) {
                        const newValue = parseFloat(tokens[0]) * Math.pow(10, exponential - 15);
                        return { value: newValue, suffix: 'Quadrillion' };
                    }
                    else if (exponential >= 12) {
                        const newValue = parseFloat(tokens[0]) * Math.pow(10, exponential - 12);
                        return { value: newValue, suffix: 'Trillion' };
                    }
                    else if (exponential >= 9) {
                        const newValue = parseFloat(tokens[0]) * Math.pow(10, exponential - 9);
                        return { value: newValue, suffix: 'Billion' };
                    }
                    else if (exponential >= 6) {
                        const newValue = parseFloat(tokens[0]) * Math.pow(10, exponential - 6);
                        return { value: newValue, suffix: 'Million' };
                    }
                }
            }
            catch (error) {
                logger.log('number: ' + number, error.message);
            }
        }
    }
    return 2;
};
exports.getCurrencyDecimalPlaces = getCurrencyDecimalPlaces;
const truncateTo = (value, digits) => {
    const p = 10 ** digits;
    return value < 0 ? Math.ceil(value * p) / p : Math.floor(value * p) / p;
};
/**
 * Format a number to a string
 * @param num The number to format
 * @param options The options to format the number in
 * @param options.locale The locale to format the number in
 * @param options.subscript Whether to use subscript notation for very small numbers
 * @returns The formatted number string
 *
 * Example:
 * formatNumber(0.000000123456) => '0.0₆1234'
 * formatNumber(12345.67812) => '12,345.67'
 * formatNumber(1000000000) => '1 Billion'
 */
const formatNumber = (num, options = {}) => {
    const { locale = 'en-US', subscript = true } = options;
    const decimalPlaces = getNumberDecimalPlaces(num, locale);
    if (typeof decimalPlaces === 'object') {
        const formatter = Intl.NumberFormat(locale, {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
        });
        return formatter.format(decimalPlaces.value) + ' ' + decimalPlaces.suffix;
    }
    // Handle very small numbers with subscript notation
    if (num > 0 && num < 1 && subscript) {
        try {
            // Use exponential notation to accurately extract significant digits and count leading zeros
            const expStr = num.toExponential();
            // Match both formats: "8e-8" (single digit) and "1.23456e-7" (with decimal)
            const expMatch = expStr.match(/^(\d)(?:\.(\d+))?e-(\d+)$/);
            if (expMatch) {
                const firstDigit = expMatch[1];
                const fractionalDigits = expMatch[2] || '';
                const exponent = parseInt(expMatch[3], 10);
                // Leading zeros = exponent - 1 (since we have one digit before decimal)
                const leadingZeros = exponent - 1;
                // Only use subscript notation if there are 3 or more leading zeros
                if (leadingZeros >= 3) {
                    // Combine first digit and fractional digits, remove trailing zeros
                    const allDigits = (firstDigit + fractionalDigits).replace(/0+$/, '');
                    // Subscript Unicode characters: ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉
                    // Supports multi-digit numbers (e.g., ₁₀, ₁₁, ..., ₂₀, ₂₁, etc.)
                    const subscriptMap = {
                        '0': '₀',
                        '1': '₁',
                        '2': '₂',
                        '3': '₃',
                        '4': '₄',
                        '5': '₅',
                        '6': '₆',
                        '7': '₇',
                        '8': '₈',
                        '9': '₉',
                    };
                    const subscript = leadingZeros
                        .toString()
                        .split('')
                        .map(d => subscriptMap[d])
                        .join('');
                    // Use significant digits directly, truncating to 4 digits (not rounding)
                    const sigDigitsFormatted = allDigits.substring(0, 4);
                    // Format "0.0" using the correct locale (e.g., "0,0" for German)
                    const zeroFormatter = Intl.NumberFormat(locale, {
                        style: 'decimal',
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                    });
                    const zeroFormatted = zeroFormatter.format(0.0);
                    return zeroFormatted + subscript + sigDigitsFormatted;
                }
            }
        }
        catch (error) {
            // If toExponential fails, fall through to normal formatting
            // This allows error handling tests to work
        }
    }
    const formatter = Intl.NumberFormat(locale, {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: decimalPlaces,
    });
    return formatter.format(truncateTo(num, decimalPlaces));
};
exports.formatNumber = formatNumber;
/**
 * Format a number to a currency string
 * @param number The number to format
 * @param options The options to format the number in
 * @param options.currency The currency to format the number in
 * @param options.locale The locale to format the number in
 * @param options.subscript Whether to use subscript notation for very small numbers
 * @returns The formatted currency string
 *
 * Example:
 * formatMoney(1000) => '$1,000.00'
 * formatMoney(0.000000123456) => '$0.0₆1234'
 */
const formatMoney = (number, options = {}) => {
    const { currency = 'USD', locale = 'en-US', subscript = true } = options;
    const decimalPlaces = getCurrencyDecimalPlaces(number, locale);
    if (typeof decimalPlaces === 'object') {
        const formatter = Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            maximumFractionDigits: 3,
        });
        return formatter.format(decimalPlaces.value) + ' ' + decimalPlaces.suffix;
    }
    // Handle very small numbers with subscript notation
    if (number > 0 && number < 1 && subscript) {
        try {
            // Use exponential notation to accurately extract significant digits and count leading zeros
            const expStr = number.toExponential();
            // Match both formats: "8e-8" (single digit) and "1.23456e-7" (with decimal)
            const expMatch = expStr.match(/^(\d)(?:\.(\d+))?e-(\d+)$/);
            if (expMatch) {
                const firstDigit = expMatch[1];
                const fractionalDigits = expMatch[2] || '';
                const exponent = parseInt(expMatch[3], 10);
                // Leading zeros = exponent - 1 (since we have one digit before decimal)
                const leadingZeros = exponent - 1;
                // Only use subscript notation if there are 3 or more leading zeros
                if (leadingZeros >= 3) {
                    // Combine first digit and fractional digits, remove trailing zeros
                    const allDigits = (firstDigit + fractionalDigits).replace(/0+$/, '');
                    // Subscript Unicode characters: ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉
                    // Supports multi-digit numbers (e.g., ₁₀, ₁₁, ..., ₂₀, ₂₁, etc.)
                    const subscriptMap = {
                        '0': '₀',
                        '1': '₁',
                        '2': '₂',
                        '3': '₃',
                        '4': '₄',
                        '5': '₅',
                        '6': '₆',
                        '7': '₇',
                        '8': '₈',
                        '9': '₉',
                    };
                    const subscriptStr = leadingZeros
                        .toString()
                        .split('')
                        .map(d => subscriptMap[d])
                        .join('');
                    // Use significant digits directly, truncating to 4 digits (not rounding)
                    const sigDigitsFormatted = allDigits.substring(0, 4);
                    // Format "0.0" using currency formatting with the correct locale
                    const zeroFormatter = Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency,
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                    });
                    const zeroFormatted = zeroFormatter.format(0.0);
                    return zeroFormatted + subscriptStr + sigDigitsFormatted;
                }
            }
        }
        catch (error) {
            // If toExponential fails, fall through to normal formatting
            // This allows error handling tests to work
        }
    }
    const formatter = Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: decimalPlaces,
    });
    return formatter.format(truncateTo(number, decimalPlaces));
};
exports.formatMoney = formatMoney;
/**
 * Get the currency symbol for a given currency
 * @param currency The currency to get the symbol for
 * @param locale The locale to get the symbol for
 * @returns The currency symbol
 *
 * Example:
 * getCurrencySymbol('USD', 'en-US') => '$'
 */
const getCurrencySymbol = (currency = 'USD', locale = 'en-US') => {
    const formatter = Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
    });
    const parts = formatter.formatToParts(1);
    const index = parts.findIndex(item => item.type === 'currency');
    if (index >= 0) {
        return parts[index].value;
    }
    return '';
};
exports.getCurrencySymbol = getCurrencySymbol;
/**
 * Format a date to a locale date string
 * @param date The date to format
 * @param locale The locale to format the date in
 * @returns The formatted date string
 *
 * Example:
 * toLocaleDateString(new Date(), 'en-US') => 'Jan 15, 2024'
 * toLocaleDateString(new Date(), 'vi-VN') => '15 thg 1, 2024'
 */
const toLocaleDateString = (date, locale = 'en-US') => {
    const formatter = Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    return formatter
        .format(date)
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/, ' ');
};
exports.toLocaleDateString = toLocaleDateString;
/**
 * Format a date to a locale time string
 * @param date The date to format
 * @param locale The locale to format the date in
 * @returns The formatted date string
 *
 * Example:
 * toLocaleTimeString(new Date(), 'en-US') => '12:00 PM'
 */
const toLocaleTimeString = (date, locale = 'en-US') => {
    const formatter = Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: 'numeric',
    });
    return formatter
        .format(date)
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/, ' ');
};
exports.toLocaleTimeString = toLocaleTimeString;
/**
 * Format a date to a locale date time string
 * @param date The date to format
 * @param locale The locale to format the date in
 * @returns The formatted date string
 *
 * Example:
 * toLocaleDateTimeString(new Date(), 'en-US') => '15. Jan. 2024, 21:30:45'
 */
const toLocaleDateTimeString = (date, locale = 'en-US') => {
    const formatter = Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
    });
    return formatter
        .format(date)
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/, ' ');
};
exports.toLocaleDateTimeString = toLocaleDateTimeString;
/**
 * Format a date to a locale day of week string
 * @param date The date to format
 * @param locale The locale to format the date in
 * @returns The formatted date string
 *
 * Example:
 * toDayOfWeek(new Date(), 'en-US') => 'Monday'
 * toDayOfWeek(new Date(), 'vi-VN') => 'Thứ Hai'
 */
const toDayOfWeek = (date, locale = 'en-US') => {
    const formatter = Intl.DateTimeFormat(locale, {
        weekday: 'long',
    });
    return formatter
        .format(date)
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/, ' ');
};
exports.toDayOfWeek = toDayOfWeek;
/**
 * Convert a timestamp to a date if it is within the last 50 years
 * @param text The timestamp to convert
 * @param locale The locale to format the date in
 * @returns The formatted date string
 *
 * Example:
 * convertTimestampToDateIfNeeds('1719091200', 'en-US') => 'Dec 22, 2025, 3:00:19 PM'
 */
const convertTimestampToDateIfNeeds = (text, locale = 'en-US') => {
    if (text) {
        try {
            const now = (0, moment_1.default)();
            // Format 1
            const num = parseInt(text, 10);
            const date = new Date(num);
            const curMoment = (0, moment_1.default)(date);
            const diff = curMoment.diff(now, 'year');
            if ((0, lodash_1.isNumber)(diff) && Math.abs(diff) < 50) {
                return (0, exports.toLocaleDateTimeString)(date, locale);
            }
            // Format 2
            const num2 = parseInt(text, 10) * 1000;
            const date2 = new Date(num2);
            const curMoment2 = (0, moment_1.default)(date2);
            const diff2 = curMoment2.diff(now, 'year');
            if ((0, lodash_1.isNumber)(diff2) && Math.abs(diff2) < 50) {
                return (0, exports.toLocaleDateTimeString)(date2, locale);
            }
        }
        catch (error) {
            logger.log('error', error);
        }
    }
    return text;
};
exports.convertTimestampToDateIfNeeds = convertTimestampToDateIfNeeds;
/**
 * Check if two strings are equal case insensitive
 * @param value1 The first value to compare
 * @param value2 The second value to compare
 * @returns True if the strings are equal case insensitive, false otherwise
 *
 * Example:
 * isEqualCaseInsensitive('hello', 'HELLO') => true
 */
function isEqualCaseInsensitive(value1, value2) {
    if (typeof value1 !== 'string' || typeof value2 !== 'string') {
        return false;
    }
    return value1.toLowerCase() === value2.toLowerCase();
}
/**
 * Format an address to a shortened address
 * @param address The wallet address to format
 * @param value The number of characters to keep at the beginning and end of the address
 * @returns The formatted address string
 *
 * Example:
 * formatWalletAddress('0x1234567890123456789012345678901234567890', 4) => '0x1234...7890'
 */
const formatWalletAddress = (address, value = 4) => {
    const addressLength = address.length;
    return (address.substring(0, value + 2) +
        '...' +
        address.substring(addressLength - value, addressLength));
};
exports.formatWalletAddress = formatWalletAddress;
