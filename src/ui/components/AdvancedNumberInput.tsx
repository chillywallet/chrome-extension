import { forwardRef, InputHTMLAttributes, useCallback, useEffect, useMemo } from 'react';
import { FiMinusCircle, FiPlusCircle } from 'react-icons/fi';
import validator from '../../shared/utils/validator';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    subtitle?: string;
    rightLabel?: string;
    desc?: string;
    changeAmount?: number;
    minValue?: number;
    error?: string;
    inputRef?: any;
    containerStyle?: any;
    inputStyle?: any;
    validations?: string[][];
    onInputError?: (error: string) => void;
    customOnChangeText?: (text: string) => void;
    onValidChangeText?: (text: string) => void;
    setValid?: (valid: boolean) => void;
    realtime?: boolean;
}

export default forwardRef<HTMLInputElement, TextInputProps>((props, ref) => {
    const {
        validations = [],
        realtime = false,
        onValidChangeText,
        setValid,
        onInputError,
        inputStyle,
        containerStyle,
        desc,
        changeAmount = 1,
        minValue = 0,
        subtitle = '',
        rightLabel = '',
        customOnChangeText,
        placeholder,
        className,
        disabled,
        ...rest
    } = props;
    const { value, onChange } = rest;

    const validateText = useCallback(
        (value: string) => {
            let isError = false;
            let error = '';

            for (let i = 0; i < validations.length; i++) {
                const rule = validations[i][0];
                const errorMessage = validations[i][1];

                if (!validator.validateRule(rule, value as string)) {
                    isError = true;
                    error = errorMessage;
                    break;
                }
            }

            return { isError, error };
        },
        [validations],
    );

    /*
    const onChangeText = useCallback(
        (text: string) => {
            if (realtime) {
                //TODO: validation
                //const isValid = inputRef.current && inputRef.current.validate(text);

                onValidChangeText && onValidChangeText(text);

                setValid && setValid(true);
            }
        },
        [realtime, onValidChangeText, setValid],
    );
    */

    const handleOnChangeText = useCallback(
        (event: any) => {
            //customOnChangeText && customOnChangeText(text);
            onChange && onChange(event);

            const { isError } = validateText(event.target.value);
            if (!isError) {
                onValidChangeText && onValidChangeText(event.target.value);
            }
        },
        [onChange, onValidChangeText, validateText],
    );

    const onMinusPress = useCallback(() => {
        // @ts-ignore
        const _value = !value || !value.trim() ? '0' : value.trim();
        const handledValue = _value.split(',').join('.');
        const number = parseFloat(handledValue);

        if (number - changeAmount < minValue) {
            handleOnChangeText && handleOnChangeText({ target: { value: minValue + '' } });
        } else {
            handleOnChangeText &&
                handleOnChangeText({ target: { value: number - changeAmount + '' } });
        }
    }, [value, changeAmount, minValue, handleOnChangeText]);

    const onPlusPress = useCallback(() => {
        // @ts-ignore
        const _value = !value || !value.trim() ? '0' : value.trim();
        const handledValue = _value.split(',').join('.');
        const number = parseFloat(handledValue);

        handleOnChangeText && handleOnChangeText({ target: { value: number + changeAmount + '' } });
    }, [value, changeAmount, handleOnChangeText]);

    const disabledStyle = useMemo(() => {
        return disabled ? { opacity: 0.3 } : null;
    }, [disabled]);

    const { isError, error } = useMemo(() => {
        return validateText(value as string);
    }, [validateText, value]);

    useEffect(() => {
        if (isError) {
            onInputError && onInputError(error);
        } else {
            onInputError && onInputError('');
        }
    }, [isError, error, onInputError]);

    return (
        <div className={className}>
            <div className="flex flex-row bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-darkline rounded-xl p-2">
                <button className="text-primary" disabled={disabled} onClick={onMinusPress}>
                    <FiMinusCircle size={20} />
                </button>
                <div className="flex-1">
                    <input
                        ref={ref}
                        {...rest}
                        onChange={e => handleOnChangeText(e)}
                        className="border-none focus:outline-none bg-transparent text-center w-full tabular-nums"
                        placeholder={placeholder}
                        style={{ ...inputStyle, ...disabledStyle }}
                        disabled={disabled}
                    />
                    {subtitle && <p className="text-xs text-neutral-500 text-center">{subtitle}</p>}
                </div>
                <button className="text-primary" disabled={disabled} onClick={onPlusPress}>
                    <FiPlusCircle size={20} />
                </button>
            </div>

            {isError && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
    );
});
