import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RadioButton from '../../../src/ui/components/RadioButton';

describe('RadioButton', () => {
    it('renders the title', () => {
        render(<RadioButton checked={false} onChange={jest.fn()} title="Option A" />);
        expect(screen.getByText('Option A')).toBeInTheDocument();
    });

    it('calls onChange with the new checked state', () => {
        const onChange = jest.fn();
        const { container } = render(
            <RadioButton checked={false} onChange={onChange} />,
        );
        const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        fireEvent.click(input);
        expect(onChange).toHaveBeenCalledWith(true);
    });
});
