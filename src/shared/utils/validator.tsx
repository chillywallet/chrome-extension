export const fulfillmentFeeValidator = (value: string, suggestedAmount: number) => {
    const handledValue = value.split(',').join('.');
    let priceFloat = parseFloat(handledValue);

    if (isNaN(priceFloat) || priceFloat <= 0) {
        return { valid: false, message: 'Gas Deposit is invalid.', color: '#f00' };
    }

    if (priceFloat < suggestedAmount) {
        return {
            valid: true,
            message:
                'Since you are depositing less gas than the suggested amount, the limit order is less likely to execute, especially during times of congestion.',
            color: '#e6d307',
        };
    }

    if (priceFloat > suggestedAmount * 2) {
        return {
            valid: true,
            message:
                'By depositing more than the recommended amount of gas, you are increasing the chances your order will execute. This is helpful if you want to compete against bots or when the blockchain network is congested.',
            color: '#07e659',
        };
    }

    return { valid: true, message: '', color: '#000' };
};

export type ValidationRules = {
    matchRegexp: (value: string, regexp: RegExp | string) => boolean;
    maxNumber: (value: string, max: string) => boolean;
    maxFloat: (value: string, max: string) => boolean;
    minNumber: (value: string, min: string) => boolean;
    minFloat: (value: string, min: string) => boolean;
    greaterThan: (value: string, min: string) => boolean;
    isEmail: (value: string) => boolean;
    isNumber: (value: string) => boolean;
    isFloat: (value: string) => boolean;
    isExisty: (value: any) => boolean;
    isEmpty: (value: any) => boolean;
    required: (value: any) => boolean;
    isPositive: (value: any) => boolean;
    isNegative: (value: any) => boolean;
    isString: (value: any) => boolean;
    minStringLength: (value: string, length: string) => boolean;
    maxStringLength: (value: string, length: string) => boolean;
    isValueMatch: (value: string, match: string) => boolean;
    validateRule: (rule: string, value: string) => boolean;
};

const validator: ValidationRules = {
    matchRegexp: (value: string, regexp: RegExp | string) => {
        const validationRegexp = regexp instanceof RegExp ? regexp : new RegExp(regexp);
        return validator.isEmpty(value) || validationRegexp.test(value);
    },

    isEmail: (value: string) =>
        validator.matchRegexp(
            value,
            /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i,
        ),

    isExisty: (value: any) => value !== null && value !== undefined,

    isEmpty: (value: any) => {
        if (value instanceof Array) {
            return value.length === 0;
        }

        if (typeof value === 'string' && validator.isExisty(value) && value.trim() === '') {
            return true;
        }

        return value === '' || !validator.isExisty(value);
    },

    required: (value: any) => !validator.isEmpty(value),

    isNumber: (value: string) => validator.matchRegexp(value, /^-?[0-9]\d*(\d+)?$/i),

    isFloat: (value: string) => validator.matchRegexp(value, /^[+-]?([0-9]*[.,])?[0-9]+$/i),

    isPositive: (value: any) => {
        if (validator.isExisty(value)) {
            return (validator.isNumber(value) || validator.isFloat(value)) && value >= 0;
        }
        return true;
    },

    isNegative: (value: any) => {
        if (validator.isExisty(value)) {
            return (validator.isNumber(value) || validator.isFloat(value)) && value < 0;
        }
        return true;
    },

    maxNumber: (value: string, max: string) =>
        validator.isEmpty(value) || parseInt(value, 10) <= parseInt(max, 10),

    minNumber: (value: string, min: string) =>
        validator.isEmpty(value) || parseInt(value, 10) >= parseInt(min, 10),

    maxFloat: (value: string, max: string) => {
        const handledValue = value.split(',').join('.');
        return validator.isEmpty(value) || parseFloat(handledValue) <= parseFloat(max);
    },

    minFloat: (value: string, min: string) => {
        const handledValue = value.split(',').join('.');
        return validator.isEmpty(value) || parseFloat(handledValue) >= parseFloat(min);
    },

    greaterThan: (value: string, min: string) => {
        const handledValue = value.split(',').join('.');
        return validator.isEmpty(value) || parseFloat(handledValue) > parseFloat(min);
    },

    isString: (value: any) =>
        !validator.isEmpty(value) || typeof value === 'string' || value instanceof String,

    minStringLength: (value: string, length: string) =>
        validator.isString(value) && value.length >= parseInt(length),

    maxStringLength: (value: string, length: string) =>
        validator.isString(value) && value.length <= parseInt(length),

    isValueMatch: (value: string, match: string) => {
        if (value === match) {
            return true;
        }
        return false;
    },
    validateRule: (rule: string, value: string) => {
        if (rule.indexOf(':') !== -1) {
            const [ruleName, ruleValue] = rule.split(':');
            // @ts-ignore
            return validator[ruleName](value, ruleValue);
        } else {
            // @ts-ignore
            return validator[rule](value);
        }
    },
};

export default validator;
