import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import OtpInput from '../../../src/ui/components/OtpCodeInput';

describe('OtpCodeInput', () => {
    it('renders the default 6 inputs', () => {
        const { container } = render(<OtpInput onChange={jest.fn()} />);
        expect(container.querySelectorAll('input').length).toBe(6);
    });

    it('renders the configured number of inputs', () => {
        const { container } = render(<OtpInput length={4} onChange={jest.fn()} />);
        expect(container.querySelectorAll('input').length).toBe(4);
    });

    it('emits the joined value on numeric input and advances focus', () => {
        const onChange = jest.fn();
        const { container } = render(<OtpInput length={4} onChange={onChange} />);
        const inputs = container.querySelectorAll('input');
        fireEvent.change(inputs[0], { target: { value: '1' } });
        expect(onChange).toHaveBeenLastCalledWith('1');
        expect(document.activeElement).toBe(inputs[1]);
    });

    it('ignores non-numeric input', () => {
        const onChange = jest.fn();
        const { container } = render(<OtpInput length={4} onChange={onChange} />);
        const inputs = container.querySelectorAll('input');
        fireEvent.change(inputs[0], { target: { value: 'a' } });
        expect(onChange).not.toHaveBeenCalled();
    });

    it('clears digit when value is empty and stays in same position', () => {
        const onChange = jest.fn();
        const { container } = render(<OtpInput length={4} onChange={onChange} />);
        const inputs = container.querySelectorAll('input');
        fireEvent.change(inputs[0], { target: { value: '5' } });
        fireEvent.change(inputs[0], { target: { value: '' } });
        expect(onChange).toHaveBeenLastCalledWith('');
    });

    it('moves focus back on Backspace when the current input is empty', () => {
        const { container } = render(<OtpInput length={4} onChange={jest.fn()} />);
        const inputs = container.querySelectorAll('input');
        (inputs[1] as HTMLInputElement).focus();
        fireEvent.keyDown(inputs[1], { key: 'Backspace' });
        expect(document.activeElement).toBe(inputs[0]);
    });

    it('handles numeric paste data', () => {
        const onChange = jest.fn();
        const { container } = render(<OtpInput length={4} onChange={onChange} />);
        const inputs = container.querySelectorAll('input');
        fireEvent.paste(inputs[0], {
            clipboardData: { getData: () => '123' },
        });
        expect(onChange).toHaveBeenLastCalledWith('123');
    });

    it('fires onEnterPress on Enter key', () => {
        const onEnterPress = jest.fn();
        const { container } = render(
            <OtpInput length={4} onChange={jest.fn()} onEnterPress={onEnterPress} />,
        );
        const inputs = container.querySelectorAll('input');
        fireEvent.keyUp(inputs[0], { key: 'Enter' });
        expect(onEnterPress).toHaveBeenCalled();
    });
});
