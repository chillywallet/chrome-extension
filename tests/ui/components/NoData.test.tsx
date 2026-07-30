import React from 'react';
import { render, screen } from '@testing-library/react';
import NoData from '../../../src/ui/components/NoData';

jest.mock('../../../src/shared/utils/Images', () => ({
    Images: {
        noResult: 'mock-no-result-image.png',
    },
}));

describe('NoData', () => {
    it('renders string children correctly', () => {
        render(<NoData>No results found</NoData>);

        expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('renders React node children correctly', () => {
        render(
            <NoData>
                <span data-testid="custom-content">Custom content</span>
            </NoData>
        );

        expect(screen.getByTestId('custom-content')).toBeInTheDocument();
        expect(screen.getByText('Custom content')).toBeInTheDocument();
    });

    it('renders the no result image', () => {
        render(<NoData>Test</NoData>);

        const image = screen.getByAltText('No Result');
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', 'mock-no-result-image.png');
    });

    it('applies correct styling classes', () => {
        const { container } = render(<NoData>Test</NoData>);

        const wrapper = container.firstChild;
        expect(wrapper).toHaveClass('flex', 'flex-1', 'flex-col', 'items-center', 'py-5');
    });

    it('renders image with correct dimensions', () => {
        render(<NoData>Test</NoData>);

        const image = screen.getByAltText('No Result');
        expect(image).toHaveClass('w-12', 'h-12', 'mb-2');
    });
});
