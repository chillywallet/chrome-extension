import React from 'react';
import { renderHook } from '@testing-library/react';
import {
    useStringToFloatSelector,
    useStringToIntSelector,
} from '../../../src/store/selectors/string';

describe('useStringToFloatSelector', () => {
    it('parses a numeric string', () => {
        const { result } = renderHook(() => useStringToFloatSelector('3.14'));
        expect(result.current.number).toBeCloseTo(3.14);
        expect(result.current.valid).toBe(true);
    });

    it('treats comma as decimal separator', () => {
        const { result } = renderHook(() => useStringToFloatSelector('3,14'));
        expect(result.current.number).toBeCloseTo(3.14);
    });

    it('falls back to default for NaN input', () => {
        const { result } = renderHook(() => useStringToFloatSelector('abc', 99));
        expect(result.current.number).toBe(99);
        expect(result.current.valid).toBe(false);
    });
});

describe('useStringToIntSelector', () => {
    it('parses an integer string', () => {
        const { result } = renderHook(() => useStringToIntSelector('42'));
        expect(result.current.number).toBe(42);
        expect(result.current.valid).toBe(true);
    });

    it('falls back to default for invalid input', () => {
        const { result } = renderHook(() => useStringToIntSelector('abc', 7));
        expect(result.current.number).toBe(7);
        expect(result.current.valid).toBe(false);
    });
});
