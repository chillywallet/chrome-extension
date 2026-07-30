import React from 'react';
import { render, screen } from '@testing-library/react';
import NetworkIcon from '../../../src/ui/components/NetworkIcon';

describe('NetworkIcon', () => {
    it('renders an img when network.icon is provided', () => {
        render(<NetworkIcon network={{ icon: 'icon.png' } as any} />);
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'icon.png');
    });

    it('renders nothing when no icon', () => {
        const { container } = render(<NetworkIcon network={{} as any} />);
        expect(container.firstChild).toBeNull();
    });

    it('uses the provided size', () => {
        render(<NetworkIcon network={{ icon: 'x.png' } as any} size={30} />);
        const img = screen.getByRole('img');
        expect(img).toHaveStyle({ width: '30px', height: '30px' });
    });
});
