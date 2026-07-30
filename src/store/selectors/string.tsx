import { useMemo } from "react";

export const useStringToFloatSelector = (numberString: string, defaultValue: number = 0) => {
    return useMemo(() => {
        const handledValue = numberString.split(',').join('.');
        let number = parseFloat(handledValue);
        let valid = true;

        if (isNaN(number)) {
            number = defaultValue;
            valid = false;
        }

        return { number, numberString, valid };
    }, [numberString, defaultValue]);
};

export const useStringToIntSelector = (numberString: string, defaultValue: number = 0) => {
    return useMemo(() => {
        const handledValue = numberString.split(',').join('.');
        let number = parseInt(handledValue, 10);
        let valid = true;

        if (isNaN(number)) {
            number = defaultValue;
            valid = false;
        }

        return { number, numberString, valid };
    }, [numberString, defaultValue]);
};