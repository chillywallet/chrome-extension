import validator, { fulfillmentFeeValidator } from '../../../src/shared/utils/validator';

describe('fulfillmentFeeValidator', () => {
    it('rejects NaN/zero/negative', () => {
        expect(fulfillmentFeeValidator('abc', 1).valid).toBe(false);
        expect(fulfillmentFeeValidator('0', 1).valid).toBe(false);
        expect(fulfillmentFeeValidator('-1', 1).valid).toBe(false);
    });

    it('warns when below suggested', () => {
        const result = fulfillmentFeeValidator('0.5', 1);
        expect(result.valid).toBe(true);
        expect(result.color).toBe('#e6d307');
    });

    it('warns when more than 2x suggested', () => {
        const result = fulfillmentFeeValidator('3', 1);
        expect(result.valid).toBe(true);
        expect(result.color).toBe('#07e659');
    });

    it('returns ok within range', () => {
        const result = fulfillmentFeeValidator('1.5', 1);
        expect(result.valid).toBe(true);
        expect(result.color).toBe('#000');
        expect(result.message).toBe('');
    });

    it('handles comma as decimal separator', () => {
        const result = fulfillmentFeeValidator('1,5', 1);
        expect(result.valid).toBe(true);
    });
});

describe('validator rules', () => {
    it('matchRegexp returns true for empty', () => {
        expect(validator.matchRegexp('', /^a+$/)).toBe(true);
    });

    it('matchRegexp accepts string pattern', () => {
        expect(validator.matchRegexp('abc', '^abc$')).toBe(true);
    });

    it('isEmail', () => {
        expect(validator.isEmail('test@example.com')).toBe(true);
        expect(validator.isEmail('bad-email')).toBe(false);
    });

    it('isExisty', () => {
        expect(validator.isExisty(0)).toBe(true);
        expect(validator.isExisty('')).toBe(true);
        expect(validator.isExisty(null)).toBe(false);
        expect(validator.isExisty(undefined)).toBe(false);
    });

    it('isEmpty', () => {
        expect(validator.isEmpty('')).toBe(true);
        expect(validator.isEmpty('   ')).toBe(true);
        expect(validator.isEmpty([])).toBe(true);
        expect(validator.isEmpty(null)).toBe(true);
        expect(validator.isEmpty('x')).toBe(false);
        expect(validator.isEmpty([1])).toBe(false);
    });

    it('required', () => {
        expect(validator.required('x')).toBe(true);
        expect(validator.required('')).toBe(false);
    });

    it('isNumber', () => {
        expect(validator.isNumber('123')).toBe(true);
        expect(validator.isNumber('1.23')).toBe(false);
    });

    it('isFloat', () => {
        expect(validator.isFloat('1.23')).toBe(true);
        expect(validator.isFloat('1,23')).toBe(true);
    });

    it('isPositive', () => {
        expect(validator.isPositive('1')).toBe(true);
        expect(validator.isPositive('-1')).toBe(false);
        expect(validator.isPositive(null)).toBe(true);
    });

    it('isNegative', () => {
        expect(validator.isNegative('-1')).toBe(true);
        expect(validator.isNegative('1')).toBe(false);
        expect(validator.isNegative(undefined)).toBe(true);
    });

    it('maxNumber and minNumber', () => {
        expect(validator.maxNumber('5', '10')).toBe(true);
        expect(validator.maxNumber('15', '10')).toBe(false);
        expect(validator.minNumber('15', '10')).toBe(true);
        expect(validator.minNumber('5', '10')).toBe(false);
        expect(validator.maxNumber('', '10')).toBe(true);
        expect(validator.minNumber('', '10')).toBe(true);
    });

    it('maxFloat / minFloat / greaterThan', () => {
        expect(validator.maxFloat('1.5', '2')).toBe(true);
        expect(validator.maxFloat('2.5', '2')).toBe(false);
        expect(validator.minFloat('2.5', '2')).toBe(true);
        expect(validator.minFloat('1.5', '2')).toBe(false);
        expect(validator.greaterThan('2.5', '2')).toBe(true);
        expect(validator.greaterThan('1.5', '2')).toBe(false);
        expect(validator.minFloat('1,5', '1')).toBe(true);
        expect(validator.greaterThan('1,5', '1')).toBe(true);
        expect(validator.maxFloat('', '2')).toBe(true);
    });

    it('isString', () => {
        expect(validator.isString('hello')).toBe(true);
    });

    it('minStringLength / maxStringLength', () => {
        expect(validator.minStringLength('abc', '2')).toBe(true);
        expect(validator.minStringLength('a', '2')).toBe(false);
        expect(validator.maxStringLength('abc', '5')).toBe(true);
        expect(validator.maxStringLength('abcdef', '5')).toBe(false);
    });

    it('isValueMatch', () => {
        expect(validator.isValueMatch('a', 'a')).toBe(true);
        expect(validator.isValueMatch('a', 'b')).toBe(false);
    });

    it('validateRule with no colon', () => {
        expect(validator.validateRule('isNumber', '123')).toBe(true);
        expect(validator.validateRule('isNumber', 'abc')).toBe(false);
    });

    it('validateRule with colon', () => {
        expect(validator.validateRule('minNumber:5', '10')).toBe(true);
        expect(validator.validateRule('maxNumber:5', '10')).toBe(false);
    });
});
