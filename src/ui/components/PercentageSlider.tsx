import _ from 'lodash';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActualTheme } from '../../store/selectors';

type Props = {
    className?: string;
    onValueChange?: (value: bigint) => void;
    value: bigint;
    maxValue: bigint;
    disabled?: boolean;
};

const BUTTONS = [
    { title: '25%', value: 25 },
    { title: '50%', value: 50 },
    { title: '75%', value: 75 },
    { title: '100%', value: 100 },
];

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

export default React.memo<Props>(function PercentageSlider({
    className,
    onValueChange,
    value,
    maxValue,
    disabled = false,
}) {
    const theme = useActualTheme();
    const [localValue, setLocalValue] = useState<number>(0);
    const [error, setError] = useState(false);

    const isDraggingRef = useRef(false);

    const isDisabled = useMemo(() => {
        return disabled || maxValue <= 0n;
    }, [disabled, maxValue]);

    /* ---------------- conversions ---------------- */

    const maxValueRef = useRef(maxValue);
    const localValueRef = useRef(localValue);

    useEffect(() => {
        localValueRef.current = localValue;
    }, [localValue]);

    const valueToPercentage = useCallback((v: bigint): number => {
        if (maxValueRef.current === 0n) return 0;
        return Number((v * 10000n) / maxValueRef.current) / 100;
    }, []);

    const percentageToValue = useCallback((percentage: number): bigint => {
        if (maxValueRef.current === 0n) return 0n;

        if (percentage >= 100) return maxValueRef.current;
        if (percentage <= 0) return 0n;

        return (maxValueRef.current * BigInt(Math.round(percentage * 100))) / 10000n;
    }, []);

    /* ---------------- debounced emit ---------------- */

    const emitValue = useMemo(() => {
        return _.debounce((v: bigint) => {
            onValueChange?.(v);
        }, 300);
    }, [onValueChange]);

    useEffect(() => {
        return () => {
            emitValue.cancel();
        };
    }, [emitValue]);

    /* ---------------- handlers ---------------- */

    const handleChange = useCallback((val: number | number[]) => {
        if (typeof val !== 'number') return;

        isDraggingRef.current = true;
        const clamped = clamp(val);
        setLocalValue(clamped);
        setError(clamped > 100);
    }, []);

    const handleChangeComplete = useCallback(
        (val: number | number[]) => {
            isDraggingRef.current = false;

            if (typeof val !== 'number') return;

            const clamped = clamp(val);
            emitValue(percentageToValue(clamped));
        },
        [emitValue, percentageToValue],
    );

    const handleButtonPress = useCallback(
        (percentage: number) => {
            const clamped = clamp(percentage);
            setLocalValue(clamped);
            setError(false);

            onValueChange?.(percentageToValue(clamped));
        },
        [onValueChange, percentageToValue],
    );

    /* ---------------- sync external value ---------------- */

    useEffect(() => {
        if (isDraggingRef.current) return;

        if (maxValueRef.current !== maxValue && maxValueRef.current !== 0n) {
            maxValueRef.current = maxValue;
            const newValue = percentageToValue(localValueRef.current);

            // Recalculate value based on current localValue (percentage)
            onValueChange?.(newValue);
            return;
        }

        maxValueRef.current = maxValue;
    }, [maxValue, onValueChange, percentageToValue]);

    useEffect(() => {
        if (isDraggingRef.current) return;

        const percentage = valueToPercentage(value);
        const clamped = clamp(Math.round(percentage));

        setLocalValue(clamped);
        setError(percentage > 100);
    }, [value, valueToPercentage]);

    /* ---------------- render ---------------- */

    return (
        <div className={`my-2 ${className ?? ''}`}>
            <div className={`w-full flex items-center ${isDisabled ? 'opacity-50' : ''}`}>
                <Slider
                    className="ml-2 flex-1"
                    min={0}
                    max={100}
                    step={5}
                    value={localValue}
                    disabled={isDisabled}
                    onChange={handleChange}
                    onChangeComplete={handleChangeComplete}
                    styles={{
                        rail: {
                            background: theme === 'light' ? '#090A0A40' : '#ffffff40',
                        },
                        track: {
                            background: error ? '#EB5E6C' : '#4AA8DC',
                        },
                        handle: {
                            borderColor: error ? '#EB5E6C' : '#4AA8DC',
                        },
                    }}
                />

                <p className={`ml-3 text-xs ${error ? 'text-[#EB5E6C]' : 'text-primary'}`}>
                    {localValue}%
                </p>
            </div>

            <div className="w-full text-xs mt-2 grid grid-cols-4 gap-x-1">
                {BUTTONS.map(btn => (
                    <button
                        key={btn.value}
                        disabled={isDisabled}
                        onClick={e => {
                            e.preventDefault();
                            handleButtonPress(btn.value);
                        }}
                        className={`rounded-md border py-1 ${
                            localValue === btn.value
                                ? 'bg-primary dark:bg-primary'
                                : 'bg-slate-50 dark:bg-darker'
                        } ${isDisabled ? 'opacity-50' : ''}`}>
                        <p className={localValue === btn.value ? 'text-white' : ''}>{btn.title}</p>
                    </button>
                ))}
            </div>
        </div>
    );
});
