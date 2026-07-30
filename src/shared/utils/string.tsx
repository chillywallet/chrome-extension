import {
    formatNumber,
    formatWalletAddress,
    isEqualCaseInsensitive as isEqualCaseInsensitiveShared,
} from './format';
import logger from './logger';

export function smartTrim(string: string, maxLength: number) {
    if (!string) return string;
    if (maxLength < 1) return string;
    if (string.length <= maxLength) return string;
    if (maxLength === 1) return string.substring(0, 1) + '...';

    var midpoint = Math.ceil(string.length / 2);
    var toremove = string.length - maxLength;
    var lstrip = Math.ceil(toremove / 2);
    var rstrip = toremove - lstrip;
    return string.substring(0, midpoint - lstrip) + '...' + string.substring(midpoint + rstrip);
}

const getLocale = () => {
    return 'en-US';
};

export const toLocaleDateTimeString = (date: Date) => {
    const locales = getLocale();
    const formatter = Intl.DateTimeFormat(locales, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    });

    return formatter
        .format(date)
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/, ' ');
};

export const toLocaleDateTimeString2 = (date: Date) => {
    const locales = getLocale();
    const formatter = Intl.DateTimeFormat(locales, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    });

    return formatter
        .format(date)
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/, ' ');
};

export const getSafeBigNumber = (num: number, decimal: number = 6) => {
    if (num < 1) {
        return parseFloat(formatNumber(num, { locale: 'en-US', subscript: false }));
    } else {
        return parseFloat(num.toFixed(decimal));
    }
};

export const getFloatNumber = (value: string, defaultValue: number = 0) => {
    const handledValue = value ? value.split(',').join('.') : '';
    let _num = parseFloat(handledValue);

    if (isNaN(_num)) {
        return defaultValue;
    }

    return _num;
};

export const toTitleCase = (string: string) => {
    return string.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};

export const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

/**
 * Extract base symbol from currency code by removing chain suffix
 * Examples: "eth_polygon" -> "eth", "usdc_ethereum" -> "usdc", "eth" -> "eth"
 */
export function extractBaseSymbol(currencyCode: string): string {
    if (!currencyCode) return currencyCode;
    const index = currencyCode.indexOf('_');
    return index > 0 ? currencyCode.substring(0, index) : currencyCode;
}

export function isEqualCaseInsensitive(value1?: string, value2?: string): boolean {
    return isEqualCaseInsensitiveShared(value1, value2);
}

export function validateEmail(email: string) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
}

export function sluggify(text: string) {
    return text
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');
}

export function matchEmail(email: string, filters: string[]) {
    const regexFilters = filters.map(filter => {
        let regex = filter.replace(/([.+?^=!:${}()|\[\]\/\\])/g, '\\$1');
        regex = regex.replace(/\*/g, '.*');
        return new RegExp(`^${regex}$`, 'i');
    });
    return regexFilters.some(regex => regex.test(email));
}

/**
 * Format a transaction timestamp for display.
 *
 * Accepts every shape the data providers produce:
 * - ISO-8601 strings (Blockscout, and anything through classify.ts)
 * - epoch seconds (Etherscan V2 `timeStamp`, BlockVision)
 * - epoch milliseconds
 *
 * The ISO case is why this exists: `parseInt('2026-07-29T09:12:07.000Z')` is 2026,
 * which as a millisecond epoch renders as Jan 1 1970. The old backend returned
 * epoch-millis strings, so a bare parseInt used to be sufficient.
 */
export const getDateTimeStringFromTimestamp = (
    timestamp: string | number | null | undefined,
) => {
    try {
        if (timestamp === null || timestamp === undefined || timestamp === '') {
            return 'N/A';
        }

        const raw = typeof timestamp === 'string' ? timestamp.trim() : timestamp;

        if (raw === '') {
            return 'N/A';
        }

        let date: Date;

        if (typeof raw === 'number' || /^\d+$/.test(raw)) {
            const value = Number(raw);

            if (!Number.isFinite(value) || value <= 0) {
                return 'N/A';
            }

            // Anything below 1e12 is seconds (1e12 ms is year 2001, 1e12 s is year 33658),
            // so the split is unambiguous for any realistic transaction date.
            date = new Date(value < 1e12 ? value * 1000 : value);
        } else {
            date = new Date(raw);
        }

        if (Number.isNaN(date.getTime())) {
            return 'N/A';
        }

        return toLocaleDateTimeString(date);
    } catch (error) {
        logger.log(timestamp, error);
    }

    return 'N/A';
};

export const formatAddress = (address: string, number: number = 4) => {
    return formatWalletAddress(address, number);
};

export function nl2br(str: string, isXhtml = true) {
    const breakTag = isXhtml ? '<br />' : '<br>';
    return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
}

export function markdownToHtml(markdown: string) {
    let html = markdown;

    //replace \\n with \n
    html = html.replace(/\\n/g, '\n');

    // Escape HTML special characters first
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Headings (###, ##, #)
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold (**text** or __text__)
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>');

    // Italic (*text* or _text_)
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    html = html.replace(/_(.*?)_/gim, '<em>$1</em>');

    // Inline code (`code`)
    html = html.replace(/`(.*?)`/gim, '<code>$1</code>');

    // Links [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank">$1</a>');

    // Unordered lists (- or *)
    html = html.replace(/^\s*[-*] (.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\s*<ul>/gim, ''); // Merge multiple lists

    // Ordered lists (1. 2. 3.)
    html = html.replace(/^\d+\. (.*$)/gim, '<ol><li>$1</li></ol>');
    html = html.replace(/<\/ol>\s*<ol>/gim, '');

    // Line breaks
    html = html.replace(/\n$/gim, '<br/>');

    return html.trim();
}
