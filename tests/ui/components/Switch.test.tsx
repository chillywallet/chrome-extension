import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import Switch from '../../../src/ui/components/Switch';

describe('Switch', () => {
    it('renders an input reflecting the checked state', () => {
        const { container } = render(<Switch checked={true} onChange={jest.fn()} />);
        const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(input).toBeInTheDocument();
        expect(input.checked).toBe(true);
    });

    it('fires onChange when toggled', () => {
        const onChange = jest.fn();
        const { container } = render(<Switch checked={false} onChange={onChange} />);
        const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        fireEvent.click(input);
        expect(onChange).toHaveBeenCalled();
    });

    it('disables when disabled is true', () => {
        const { container } = render(
            <Switch checked={false} onChange={jest.fn()} disabled={true} />,
        );
        const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(input.disabled).toBe(true);
    });
});
