import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Checkbox from '../../../src/ui/components/Checkbox';

describe('Checkbox', () => {
    it('renders the title', () => {
        render(<Checkbox checked={false} onChange={jest.fn()} title="Accept" />);
        expect(screen.getByText('Accept')).toBeInTheDocument();
    });

    it('toggles state via the inner label click', () => {
        const onChange = jest.fn();
        const { container } = render(<Checkbox checked={false} onChange={onChange} />);
        const labels = container.querySelectorAll('label');
        // The clickable inner label is the second one (root > inline-flex > label)
        const inner = labels[labels.length - 1] as HTMLLabelElement;
        fireEvent.click(inner);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('renders the check icon when checked', () => {
        const { container } = render(<Checkbox checked={true} onChange={jest.fn()} />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with disabled styling and ignores clicks', () => {
        const onChange = jest.fn();
        const { container } = render(<Checkbox checked={false} onChange={onChange} disabled />);
        const labels = container.querySelectorAll('label');
        const inner = labels[labels.length - 1] as HTMLLabelElement;
        expect(inner.getAttribute('aria-disabled')).toBe('true');
        expect(inner.className).toContain('cursor-not-allowed');
        fireEvent.click(inner);
        expect(onChange).not.toHaveBeenCalled();
    });
});
