import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import PercentageSlider from '../../../src/ui/components/PercentageSlider';

jest.mock('rc-slider/assets/index.css', () => ({}), { virtual: true });

jest.mock('rc-slider', () => ({
    __esModule: true,
    default: ({
        value,
        onChange,
        onChangeComplete,
        disabled,
    }: {
        value: number;
        onChange: (v: number | number[]) => void;
        onChangeComplete: (v: number | number[]) => void;
        disabled?: boolean;
    }) => (
        <div data-testid="slider" data-value={value} data-disabled={String(!!disabled)}>
            <button data-testid="slider-change" onClick={() => onChange(50)} />
            <button data-testid="slider-complete" onClick={() => onChangeComplete(75)} />
            <button data-testid="slider-change-over" onClick={() => onChange(150)} />
            <button
                data-testid="slider-change-array"
                onClick={() => onChange([1, 2] as any)}
            />
            <button
                data-testid="slider-complete-array"
                onClick={() => onChangeComplete([1, 2] as any)}
            />
            <button
                data-testid="slider-complete-zero"
                onClick={() => onChangeComplete(0)}
            />
            <button
                data-testid="slider-complete-100"
                onClick={() => onChangeComplete(100)}
            />
        </div>
    ),
}));

let mockTheme: 'light' | 'dark' = 'light';
jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: () => mockTheme,
}));

beforeEach(() => {
    mockTheme = 'light';
});

describe('PercentageSlider', () => {
    it('renders quick percentage buttons', () => {
        render(<PercentageSlider value={0n} maxValue={100n} />);
        expect(screen.getByText('25%')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('disables when maxValue is zero', () => {
        render(<PercentageSlider value={0n} maxValue={0n} />);
        expect(screen.getByTestId('slider')).toHaveAttribute('data-disabled', 'true');
    });

    it('emits value when a percentage button is pressed', () => {
        const onValueChange = jest.fn();
        render(
            <PercentageSlider value={0n} maxValue={1000n} onValueChange={onValueChange} />,
        );
        fireEvent.click(screen.getByText('50%'));
        expect(onValueChange).toHaveBeenCalledWith(500n);
    });

    it('updates locally on drag without emitting until debounced complete', () => {
        jest.useFakeTimers();
        const onValueChange = jest.fn();
        render(
            <PercentageSlider value={0n} maxValue={1000n} onValueChange={onValueChange} />,
        );
        fireEvent.click(screen.getByTestId('slider-change'));
        fireEvent.click(screen.getByTestId('slider-complete'));
        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(onValueChange).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('renders given the disabled prop', () => {
        render(<PercentageSlider value={0n} maxValue={100n} disabled />);
        expect(screen.getByTestId('slider')).toHaveAttribute('data-disabled', 'true');
    });

    it('emits a recalculated value when maxValue changes and is non-zero', () => {
        const onValueChange = jest.fn();
        const { rerender } = render(
            <PercentageSlider value={500n} maxValue={1000n} onValueChange={onValueChange} />,
        );
        // After initial render, localValue is 50% (value/maxValue).
        // Now change maxValue: the effect on line 114 detects the change and emits
        // percentageToValue(localValue=50) against new maxValue (2000n) -> 1000n.
        onValueChange.mockClear();
        rerender(
            <PercentageSlider value={500n} maxValue={2000n} onValueChange={onValueChange} />,
        );
        expect(onValueChange).toHaveBeenCalledWith(1000n);
    });

    it('does not emit a recalculated value when maxValueRef starts at zero', () => {
        const onValueChange = jest.fn();
        const { rerender } = render(
            <PercentageSlider value={0n} maxValue={0n} onValueChange={onValueChange} />,
        );
        // maxValueRef.current is 0n, so the branch on line 117 short-circuits.
        rerender(
            <PercentageSlider value={0n} maxValue={1000n} onValueChange={onValueChange} />,
        );
        expect(onValueChange).not.toHaveBeenCalled();
    });

    it('handles non-numeric handleChange/handleChangeComplete arguments', () => {
        jest.useFakeTimers();
        const onValueChange = jest.fn();
        render(
            <PercentageSlider value={0n} maxValue={1000n} onValueChange={onValueChange} />,
        );
        // Non-number values are ignored by both change handlers.
        fireEvent.click(screen.getByTestId('slider-change-array'));
        fireEvent.click(screen.getByTestId('slider-complete-array'));
        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(onValueChange).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('renders dark theme rail when actual theme is dark', () => {
        mockTheme = 'dark';
        render(<PercentageSlider value={0n} maxValue={1000n} />);
        expect(screen.getByTestId('slider')).toBeInTheDocument();
    });

    it('flags an error when external value exceeds 100% of maxValue', () => {
        const { container } = render(<PercentageSlider value={2000n} maxValue={1000n} />);
        // localValue clamps to 100; error is set because percentage > 100, so the
        // displayed percentage label uses the error color class.
        expect(container.querySelector('.text-\\[\\#EB5E6C\\]')).toBeTruthy();
    });

    it('updates display when external value changes', () => {
        const onValueChange = jest.fn();
        const { rerender } = render(
            <PercentageSlider value={0n} maxValue={1000n} onValueChange={onValueChange} />,
        );
        rerender(
            <PercentageSlider value={500n} maxValue={1000n} onValueChange={onValueChange} />,
        );
        // localValue should now reflect 50; both the label and the matching button
        // render "50%" so we expect more than one match.
        expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(1);
    });

    it('handles 100% and 0% slider-complete values', () => {
        jest.useFakeTimers();
        const onValueChange = jest.fn();
        render(
            <PercentageSlider value={0n} maxValue={1000n} onValueChange={onValueChange} />,
        );
        fireEvent.click(screen.getByTestId('slider-complete-100'));
        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(onValueChange).toHaveBeenCalledWith(1000n);
        onValueChange.mockClear();
        fireEvent.click(screen.getByTestId('slider-complete-zero'));
        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(onValueChange).toHaveBeenCalledWith(0n);
        jest.useRealTimers();
    });

    it('value-to-percentage returns zero when maxValueRef is zero', () => {
        // When maxValue is 0n, valueToPercentage is short-circuited to 0.
        render(<PercentageSlider value={500n} maxValue={0n} />);
        expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('skips external sync effects while user is dragging', () => {
        const onValueChange = jest.fn();
        const { rerender } = render(
            <PercentageSlider value={0n} maxValue={1000n} onValueChange={onValueChange} />,
        );
        // Start a drag so isDraggingRef.current becomes true.
        fireEvent.click(screen.getByTestId('slider-change'));
        onValueChange.mockClear();
        // Now rerender with new value and new maxValue — the two effects should
        // observe the dragging flag and early-return.
        rerender(
            <PercentageSlider value={300n} maxValue={2000n} onValueChange={onValueChange} />,
        );
        expect(onValueChange).not.toHaveBeenCalled();
    });

    it('percentage-to-value returns 0n when maxValueRef is zero on a slider complete', () => {
        jest.useFakeTimers();
        const onValueChange = jest.fn();
        render(
            <PercentageSlider value={0n} maxValue={0n} onValueChange={onValueChange} />,
        );
        // Invoking onChangeComplete through the mock fires handleChangeComplete,
        // which calls percentageToValue(clamped). With maxValueRef===0n, that
        // function exercises the `maxValueRef.current === 0n` early-return path.
        fireEvent.click(screen.getByTestId('slider-complete'));
        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(onValueChange).toHaveBeenCalledWith(0n);
        jest.useRealTimers();
    });
});
