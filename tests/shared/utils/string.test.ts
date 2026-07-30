import {
    smartTrim,
    toLocaleDateTimeString,
    toLocaleDateTimeString2,
    getSafeBigNumber,
    getFloatNumber,
    toTitleCase,
    capitalizeFirstLetter,
    extractBaseSymbol,
    isEqualCaseInsensitive,
    validateEmail,
    sluggify,
    matchEmail,
    getDateTimeStringFromTimestamp,
    formatAddress,
    nl2br,
    markdownToHtml,
} from '../../../src/shared/utils/string';

describe('string utils', () => {
    describe('smartTrim', () => {
        it('returns input when empty', () => {
            expect(smartTrim('', 10)).toBe('');
            expect(smartTrim(undefined as unknown as string, 10)).toBeUndefined();
        });

        it('returns input when maxLength < 1', () => {
            expect(smartTrim('hello', 0)).toBe('hello');
        });

        it('returns input when length <= maxLength', () => {
            expect(smartTrim('hi', 10)).toBe('hi');
        });

        it('returns 1 char + ... when maxLength === 1', () => {
            expect(smartTrim('abcdef', 1)).toBe('a...');
        });

        it('trims from the middle for longer strings', () => {
            const result = smartTrim('0123456789abcdef', 8);
            expect(result).toContain('...');
            expect(result.length).toBeLessThan(16);
        });
    });

    describe('toLocaleDateTimeString and toLocaleDateTimeString2', () => {
        it('formats a date', () => {
            const d = new Date('2024-01-15T10:30:00Z');
            const result = toLocaleDateTimeString(d);
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('toLocaleDateTimeString2 formats a date', () => {
            const d = new Date('2024-01-15T10:30:00Z');
            const result = toLocaleDateTimeString2(d);
            expect(typeof result).toBe('string');
        });
    });

    describe('getSafeBigNumber', () => {
        it('handles numbers < 1', () => {
            const result = getSafeBigNumber(0.5);
            expect(typeof result).toBe('number');
        });

        it('handles numbers >= 1', () => {
            expect(getSafeBigNumber(1.123456789)).toBe(1.123457);
        });

        it('honors decimal param', () => {
            expect(getSafeBigNumber(2.5, 2)).toBe(2.5);
        });
    });

    describe('getFloatNumber', () => {
        it('parses numeric string', () => {
            expect(getFloatNumber('3.14')).toBeCloseTo(3.14);
        });

        it('handles comma as decimal separator', () => {
            expect(getFloatNumber('3,14')).toBeCloseTo(3.14);
        });

        it('returns default when not a number', () => {
            expect(getFloatNumber('abc')).toBe(0);
            expect(getFloatNumber('abc', 42)).toBe(42);
        });

        it('returns default for empty string', () => {
            expect(getFloatNumber('')).toBe(0);
        });
    });

    describe('toTitleCase', () => {
        it('capitalizes each word', () => {
            expect(toTitleCase('hello world')).toBe('Hello World');
        });

        it('handles mixed case', () => {
            expect(toTitleCase('hELLo WORLd')).toBe('Hello World');
        });
    });

    describe('capitalizeFirstLetter', () => {
        it('capitalizes only the first letter', () => {
            expect(capitalizeFirstLetter('hello')).toBe('Hello');
            expect(capitalizeFirstLetter('hello world')).toBe('Hello world');
        });
    });

    describe('extractBaseSymbol', () => {
        it('returns empty for empty input', () => {
            expect(extractBaseSymbol('')).toBe('');
        });

        it('extracts the prefix before underscore', () => {
            expect(extractBaseSymbol('eth_polygon')).toBe('eth');
            expect(extractBaseSymbol('usdc_ethereum')).toBe('usdc');
        });

        it('returns input when no underscore', () => {
            expect(extractBaseSymbol('eth')).toBe('eth');
        });
    });

    describe('isEqualCaseInsensitive', () => {
        it('compares case-insensitively', () => {
            expect(isEqualCaseInsensitive('Hello', 'hello')).toBe(true);
            expect(isEqualCaseInsensitive('Hello', 'world')).toBe(false);
        });
    });

    describe('validateEmail', () => {
        it('accepts valid emails', () => {
            expect(validateEmail('test@example.com')).toBe(true);
            expect(validateEmail('foo.bar+tag@sub.domain.co')).toBe(true);
        });

        it('rejects invalid emails', () => {
            expect(validateEmail('not-an-email')).toBe(false);
            expect(validateEmail('foo@')).toBe(false);
        });
    });

    describe('sluggify', () => {
        it('lowercases and replaces spaces', () => {
            expect(sluggify('Hello World')).toBe('hello-world');
        });

        it('removes special chars', () => {
            expect(sluggify('Hello, World!')).toBe('hello-world');
        });
    });

    describe('matchEmail', () => {
        it('matches with wildcard', () => {
            expect(matchEmail('test@example.com', ['*@example.com'])).toBe(true);
            expect(matchEmail('test@other.com', ['*@example.com'])).toBe(false);
        });

        it('matches exact', () => {
            expect(matchEmail('a@b.com', ['a@b.com'])).toBe(true);
        });
    });

    describe('getDateTimeStringFromTimestamp', () => {
        it('formats a numeric timestamp', () => {
            const ts = Date.now().toString();
            const result = getDateTimeStringFromTimestamp(ts);
            expect(typeof result).toBe('string');
            expect(result).not.toBe('N/A');
        });

        it('returns N/A for empty timestamp', () => {
            expect(getDateTimeStringFromTimestamp('')).toBe('N/A');
        });

        // Regression: the data providers emit ISO-8601, and parseInt('2026-…') is 2026,
        // which rendered every transaction as Jan 1 1970.
        it('formats an ISO-8601 timestamp to its real date, not the epoch', () => {
            const result = getDateTimeStringFromTimestamp('2026-07-29T09:12:07.000Z');
            expect(result).toContain('2026');
            expect(result).not.toContain('1970');
        });

        it('treats a 10-digit value as epoch seconds', () => {
            // 1753780327 => 2025-07-29
            const result = getDateTimeStringFromTimestamp('1753780327');
            expect(result).toContain('2025');
            expect(result).not.toContain('1970');
        });

        it('treats a 13-digit value as epoch milliseconds', () => {
            const result = getDateTimeStringFromTimestamp('1753780327000');
            expect(result).toContain('2025');
        });

        it('accepts a number as well as a string', () => {
            expect(getDateTimeStringFromTimestamp(1753780327)).toContain('2025');
        });

        it('returns N/A for unparseable or zero values', () => {
            expect(getDateTimeStringFromTimestamp('not-a-date')).toBe('N/A');
            expect(getDateTimeStringFromTimestamp('0')).toBe('N/A');
            expect(getDateTimeStringFromTimestamp(null)).toBe('N/A');
            expect(getDateTimeStringFromTimestamp(undefined)).toBe('N/A');
        });
    });

    describe('formatAddress', () => {
        it('shortens long addresses', () => {
            const result = formatAddress('0x1234567890abcdef1234567890abcdef12345678');
            expect(result).toContain('...');
        });
    });

    describe('nl2br', () => {
        it('converts newlines to <br/>', () => {
            expect(nl2br('a\nb')).toContain('<br />');
        });

        it('uses <br> when isXhtml = false', () => {
            const out = nl2br('a\nb', false);
            expect(out).toContain('<br>');
        });
    });

    describe('markdownToHtml', () => {
        it('converts headings', () => {
            expect(markdownToHtml('# Title')).toContain('<h1>Title</h1>');
            expect(markdownToHtml('## Title')).toContain('<h2>Title</h2>');
            expect(markdownToHtml('### Title')).toContain('<h3>Title</h3>');
        });

        it('converts bold and italic', () => {
            expect(markdownToHtml('**bold**')).toContain('<strong>bold</strong>');
            expect(markdownToHtml('__bold__')).toContain('<strong>bold</strong>');
        });

        it('converts inline code', () => {
            expect(markdownToHtml('`code`')).toContain('<code>code</code>');
        });

        it('converts links', () => {
            const out = markdownToHtml('[text](https://a.com)');
            expect(out).toContain('href="https://a.com"');
            expect(out).toContain('target="_blank"');
        });

        it('escapes HTML special characters', () => {
            const out = markdownToHtml('<script>');
            expect(out).toContain('&lt;script&gt;');
        });

        it('converts escaped newlines', () => {
            const out = markdownToHtml('a\\nb');
            expect(out).toMatch(/a[\s\S]*b/);
        });

        it('converts unordered lists', () => {
            const out = markdownToHtml('- item');
            expect(out).toContain('<li>item</li>');
        });

        it('converts ordered lists', () => {
            const out = markdownToHtml('1. item');
            expect(out).toContain('<li>item</li>');
        });
    });
});
