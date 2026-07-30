type NewFormat = {
    value: number;
    suffix: string;
};
/**
 * Set custom logger
 * @param customLogger Logger object with log method
 */
export declare function setLogger(customLogger: {
    log: (message?: any, ...optionalParams: any[]) => void;
}): void;
/**
 * Get the current logger (for testing purposes)
 * @returns The current logger instance
 */
export declare function getLogger(): {
    log: (message?: any, ...optionalParams: any[]) => void;
};
declare const getDecimalPlaces: (number: number) => number;
declare const getNumberDecimalPlaces: (number: number, locale?: string) => number | NewFormat;
declare const getCurrencyDecimalPlaces: (number: number, locale?: string) => number | NewFormat;
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
export declare const formatNumber: (num: number, options?: {
    locale?: string;
    subscript?: boolean;
}) => string;
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
export declare const formatMoney: (number: number, options?: {
    currency?: string;
    locale?: string;
    subscript?: boolean;
}) => string;
/**
 * Get the currency symbol for a given currency
 * @param currency The currency to get the symbol for
 * @param locale The locale to get the symbol for
 * @returns The currency symbol
 *
 * Example:
 * getCurrencySymbol('USD', 'en-US') => '$'
 */
export declare const getCurrencySymbol: (currency?: string, locale?: string) => string;
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
export declare const toLocaleDateString: (date: Date, locale?: string) => string;
/**
 * Format a date to a locale time string
 * @param date The date to format
 * @param locale The locale to format the date in
 * @returns The formatted date string
 *
 * Example:
 * toLocaleTimeString(new Date(), 'en-US') => '12:00 PM'
 */
export declare const toLocaleTimeString: (date: Date, locale?: string) => string;
/**
 * Format a date to a locale date time string
 * @param date The date to format
 * @param locale The locale to format the date in
 * @returns The formatted date string
 *
 * Example:
 * toLocaleDateTimeString(new Date(), 'en-US') => '15. Jan. 2024, 21:30:45'
 */
export declare const toLocaleDateTimeString: (date: Date, locale?: string) => string;
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
export declare const toDayOfWeek: (date: Date, locale?: string) => string;
/**
 * Convert a timestamp to a date if it is within the last 50 years
 * @param text The timestamp to convert
 * @param locale The locale to format the date in
 * @returns The formatted date string
 *
 * Example:
 * convertTimestampToDateIfNeeds('1719091200', 'en-US') => 'Dec 22, 2025, 3:00:19 PM'
 */
export declare const convertTimestampToDateIfNeeds: (text: string, locale?: string) => string;
/**
 * Check if two strings are equal case insensitive
 * @param value1 The first value to compare
 * @param value2 The second value to compare
 * @returns True if the strings are equal case insensitive, false otherwise
 *
 * Example:
 * isEqualCaseInsensitive('hello', 'HELLO') => true
 */
export declare function isEqualCaseInsensitive(value1: string | undefined | null, value2: string | undefined | null): boolean;
/**
 * Format an address to a shortened address
 * @param address The wallet address to format
 * @param value The number of characters to keep at the beginning and end of the address
 * @returns The formatted address string
 *
 * Example:
 * formatWalletAddress('0x1234567890123456789012345678901234567890', 4) => '0x1234...7890'
 */
export declare const formatWalletAddress: (address: string, value?: number) => string;
export { getCurrencyDecimalPlaces, getDecimalPlaces, getNumberDecimalPlaces };
