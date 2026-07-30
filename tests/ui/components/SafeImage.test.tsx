import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SafeImage from '../../../src/ui/components/SafeImage';

describe('SafeImage', () => {
    it('renders an img when src is provided', () => {
        render(<SafeImage src="https://x.test/a.png" alt="x" />);
        const img = screen.getByAltText('x');
        expect(img).toHaveAttribute('src', 'https://x.test/a.png');
    });

    it('renders fallback when no src and fallback is set', () => {
        render(<SafeImage src={null} alt="x" fallback="fallback.png" />);
        const img = screen.getByAltText('x');
        expect(img).toHaveAttribute('src', 'fallback.png');
    });

    it('renders defaultPlaceholder when no src and no fallback', () => {
        render(
            <SafeImage
                src={null}
                alt="x"
                defaultPlaceholder={<div data-testid="placeholder">P</div>}
            />,
        );
        expect(screen.getByTestId('placeholder')).toBeInTheDocument();
    });

    it('renders the icon placeholder when no src, no fallback, no defaultPlaceholder', () => {
        const { container } = render(<SafeImage src={null} alt="x" />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('shows placeholder when image errors', () => {
        render(<SafeImage src="bad.png" alt="x" fallback="fallback.png" />);
        const img = screen.getByAltText('x');
        fireEvent.error(img);
        expect(screen.getByAltText('x')).toHaveAttribute('src', 'fallback.png');
    });

    it('updates when src changes', () => {
        const { rerender } = render(<SafeImage src="a.png" alt="x" />);
        expect(screen.getByAltText('x')).toHaveAttribute('src', 'a.png');
        rerender(<SafeImage src="b.png" alt="x" />);
        expect(screen.getByAltText('x')).toHaveAttribute('src', 'b.png');
    });

    it('shows placeholder when src changes to null', () => {
        const { rerender, container } = render(<SafeImage src="a.png" alt="x" />);
        expect(screen.getByAltText('x')).toBeInTheDocument();
        rerender(<SafeImage src={null} alt="x" />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });
});
