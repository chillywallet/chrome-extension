import React from 'react';
import { render, screen } from '@testing-library/react';
import MarketStatRow from '../../../src/ui/components/MarketStatRow';

describe('MarketStatRow', () => {
    it('renders label and value', () => {
        render(<MarketStatRow label="Cap" value="$1B" />);
        expect(screen.getByText('Cap')).toBeInTheDocument();
        expect(screen.getByText('$1B')).toBeInTheDocument();
    });

    it('renders a React node value', () => {
        render(
            <MarketStatRow
                label="Item"
                value={<span data-testid="custom">Custom</span>}
            />,
        );
        expect(screen.getByTestId('custom')).toBeInTheDocument();
    });

    it('applies extra className', () => {
        const { container } = render(
            <MarketStatRow label="A" value="B" className="extra-class" />,
        );
        expect(container.firstChild).toHaveClass('extra-class');
    });
});
