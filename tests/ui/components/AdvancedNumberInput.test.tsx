import React, { createRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AdvancedNumberInput from '../../../src/ui/components/AdvancedNumberInput';

describe('AdvancedNumberInput', () => {
    it('renders input and increment/decrement controls', () => {
        render(<AdvancedNumberInput placeholder="amount" />);
        expect(screen.getByPlaceholderText('amount')).toBeInTheDocument();
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(2);
    });

    it('forwards ref to the input', () => {
        const ref = createRef<HTMLInputElement>();
        render(<AdvancedNumberInput ref={ref} placeholder="x" />);
        expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('applies className to the outer wrapper', () => {
        const { container } = render(<AdvancedNumberInput className="my-wrap" placeholder="x" />);
        expect(container.firstChild).toHaveClass('my-wrap');
    });

    it('shows subtitle when provided', () => {
        render(<AdvancedNumberInput subtitle="hint text" placeholder="x" />);
        expect(screen.getByText('hint text')).toBeInTheDocument();
    });

    it('forwards change events from the input', () => {
        const onChange = jest.fn();
        render(<AdvancedNumberInput onChange={onChange} placeholder="x" />);
        fireEvent.change(screen.getByPlaceholderText('x'), { target: { value: '42' } });
        expect(onChange).toHaveBeenCalled();
    });

    it('handles change when onChange is omitted', () => {
        const onValidChangeText = jest.fn();
        render(
            <AdvancedNumberInput
                value=""
                validations={[]}
                onValidChangeText={onValidChangeText}
                placeholder="x"
            />,
        );
        fireEvent.change(screen.getByPlaceholderText('x'), { target: { value: '9' } });
        expect(onValidChangeText).toHaveBeenCalledWith('9');
    });

    it('calls onValidChangeText when value passes validations', () => {
        const onValidChangeText = jest.fn();
        const onChange = jest.fn();
        render(
            <AdvancedNumberInput
                value=""
                onChange={onChange}
                validations={[['maxFloat:100', 'too high']]}
                onValidChangeText={onValidChangeText}
                placeholder="x"
            />,
        );
        fireEvent.change(screen.getByPlaceholderText('x'), { target: { value: '10' } });
        expect(onValidChangeText).toHaveBeenCalledWith('10');
    });

    it('does not call onValidChangeText when validation fails', () => {
        const onValidChangeText = jest.fn();
        render(
            <AdvancedNumberInput
                validations={[['maxFloat:5', 'too high']]}
                value="10"
                onChange={() => {}}
                onValidChangeText={onValidChangeText}
                placeholder="x"
            />,
        );
        fireEvent.change(screen.getByPlaceholderText('x'), { target: { value: '10' } });
        expect(onValidChangeText).not.toHaveBeenCalled();
    });

    it('shows validation error message when invalid', () => {
        render(
            <AdvancedNumberInput
                validations={[['maxFloat:5', 'too high']]}
                value="10"
                onChange={() => {}}
                placeholder="x"
            />,
        );
        expect(screen.getByText('too high')).toBeInTheDocument();
    });

    it('works when onInputError is omitted (valid and invalid)', () => {
        const { rerender } = render(
            <AdvancedNumberInput
                validations={[['maxFloat:5', 'too high']]}
                value="10"
                onChange={() => {}}
                placeholder="x"
            />,
        );
        expect(screen.getByText('too high')).toBeInTheDocument();
        rerender(
            <AdvancedNumberInput
                validations={[['maxFloat:5', 'too high']]}
                value="3"
                onChange={() => {}}
                placeholder="x"
            />,
        );
        expect(screen.queryByText('too high')).not.toBeInTheDocument();
    });

    it('notifies onInputError when invalid and clears when valid', () => {
        const onInputError = jest.fn();
        const { rerender } = render(
            <AdvancedNumberInput
                validations={[['maxFloat:5', 'too high']]}
                value="3"
                onChange={() => {}}
                onInputError={onInputError}
                placeholder="x"
            />,
        );
        expect(onInputError).toHaveBeenLastCalledWith('');

        rerender(
            <AdvancedNumberInput
                validations={[['maxFloat:5', 'too high']]}
                value="10"
                onChange={() => {}}
                onInputError={onInputError}
                placeholder="x"
            />,
        );
        expect(onInputError).toHaveBeenLastCalledWith('too high');
    });

    it('increments via plus using changeAmount', () => {
        const onChange = jest.fn();
        render(
            <AdvancedNumberInput
                value="5"
                onChange={onChange}
                changeAmount={2}
                placeholder="x"
            />,
        );
        const [, plus] = screen.getAllByRole('button');
        fireEvent.click(plus);
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ target: expect.objectContaining({ value: '7' }) }),
        );
    });

    it('treats whitespace-only value as zero when using plus', () => {
        const onChange = jest.fn();
        render(<AdvancedNumberInput value="   " onChange={onChange} placeholder="x" />);
        const [, plus] = screen.getAllByRole('button');
        fireEvent.click(plus);
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ target: expect.objectContaining({ value: '1' }) }),
        );
    });

    it('treats empty value as zero when using plus', () => {
        const onChange = jest.fn();
        render(<AdvancedNumberInput onChange={onChange} placeholder="x" />);
        const [, plus] = screen.getAllByRole('button');
        fireEvent.click(plus);
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ target: expect.objectContaining({ value: '1' }) }),
        );
    });

    it('decrements via minus and clamps at minValue when already at minimum', () => {
        const onChange = jest.fn();
        const Controlled = () => {
            const [value, setValue] = useState('1');
            return (
                <AdvancedNumberInput
                    value={value}
                    onChange={e => {
                        setValue(e.target.value);
                        onChange(e);
                    }}
                    changeAmount={1}
                    minValue={0}
                    placeholder="x"
                />
            );
        };
        render(<Controlled />);
        const [minus] = screen.getAllByRole('button');
        fireEvent.click(minus);
        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ target: expect.objectContaining({ value: '0' }) }),
        );

        onChange.mockClear();
        fireEvent.click(minus);
        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ target: expect.objectContaining({ value: '0' }) }),
        );
    });

    it('parses comma as decimal separator for +/-', () => {
        const onChange = jest.fn();
        render(
            <AdvancedNumberInput value="1,5" onChange={onChange} changeAmount={1} placeholder="x" />,
        );
        const [, plus] = screen.getAllByRole('button');
        fireEvent.click(plus);
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ target: expect.objectContaining({ value: '2.5' }) }),
        );
    });

    it('trims surrounding whitespace when adjusting with +/-', () => {
        const onChange = jest.fn();
        render(
            <AdvancedNumberInput value="  3  " onChange={onChange} changeAmount={1} placeholder="x" />,
        );
        const [, plus] = screen.getAllByRole('button');
        fireEvent.click(plus);
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ target: expect.objectContaining({ value: '4' }) }),
        );
    });

    it('runs validation on change without onValidChangeText', () => {
        const onChange = jest.fn();
        render(
            <AdvancedNumberInput value="" onChange={onChange} placeholder="x" validations={[]} />,
        );
        fireEvent.change(screen.getByPlaceholderText('x'), { target: { value: '1' } });
        expect(onChange).toHaveBeenCalled();
    });

    it('uses the first failing validation rule only', () => {
        render(
            <AdvancedNumberInput
                validations={[
                    ['maxFloat:5', 'first error'],
                    ['isFloat', 'second error'],
                ]}
                value="10"
                onChange={() => {}}
                placeholder="x"
            />,
        );
        expect(screen.getByText('first error')).toBeInTheDocument();
        expect(screen.queryByText('second error')).not.toBeInTheDocument();
    });

    it('merges inputStyle with disabled opacity', () => {
        render(
            <AdvancedNumberInput
                disabled
                inputStyle={{ color: 'red' }}
                placeholder="x"
            />,
        );
        const input = screen.getByPlaceholderText('x') as HTMLElement;
        expect(input.style.color).toBe('red');
        expect(input.style.opacity).toBe('0.3');
    });

    it('disables buttons and applies disabled styling to input', () => {
        render(<AdvancedNumberInput disabled placeholder="x" />);
        const [minus, plus] = screen.getAllByRole('button');
        expect(minus).toBeDisabled();
        expect(plus).toBeDisabled();
        const input = screen.getByPlaceholderText('x') as HTMLElement;
        expect(input).toBeDisabled();
        expect(input.style.opacity).toBe('0.3');
    });
});
