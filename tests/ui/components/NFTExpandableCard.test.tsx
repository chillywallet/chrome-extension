import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import NFTExpandableCard from '../../../src/ui/components/NFTExpandableCard';

describe('NFTExpandableCard', () => {
    it('renders title and starts collapsed by default', () => {
        render(
            <NFTExpandableCard title="Section">
                <div data-testid="inner">Hello</div>
            </NFTExpandableCard>,
        );
        expect(screen.getByText('Section')).toBeInTheDocument();
        const inner = screen.getByTestId('inner').parentElement;
        expect(inner).toHaveClass('hidden');
    });

    it('expands by default when defaultExpanded=true', () => {
        render(
            <NFTExpandableCard title="X" defaultExpanded={true}>
                <div data-testid="inner">Hello</div>
            </NFTExpandableCard>,
        );
        const inner = screen.getByTestId('inner').parentElement;
        expect(inner).toHaveClass('block');
    });

    it('toggles when title row is clicked', () => {
        render(
            <NFTExpandableCard title="Toggle">
                <div data-testid="inner">Hello</div>
            </NFTExpandableCard>,
        );
        const inner = screen.getByTestId('inner').parentElement;
        expect(inner).toHaveClass('hidden');

        fireEvent.click(screen.getByText('Toggle'));
        expect(inner).toHaveClass('block');
    });
});
