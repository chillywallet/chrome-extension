import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import FavoriteButton from '../../../src/ui/components/FavoriteButton';
import { useActualTheme } from '../../../src/store/selectors';

jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: jest.fn(),
}));

describe('FavoriteButton', () => {
    beforeEach(() => {
        (useActualTheme as jest.Mock).mockReturnValue('light');
    });

    it('renders filled star and calls onRemove when isFavorite', () => {
        const onRemove = jest.fn();
        render(
            <FavoriteButton
                isFavorite={true}
                onAdd={jest.fn()}
                onRemove={onRemove}
            />,
        );
        const div = document.querySelector(
            '[data-tooltip-content="Coin is already in favorites"]',
        ) as HTMLElement;
        fireEvent.click(div);
        expect(onRemove).toHaveBeenCalled();
    });

    it('renders empty star and calls onAdd when not favorite', () => {
        const onAdd = jest.fn();
        render(
            <FavoriteButton
                isFavorite={false}
                onAdd={onAdd}
                onRemove={jest.fn()}
            />,
        );
        const div = document.querySelector('[data-tooltip-content="Add to favorites"]') as HTMLElement;
        fireEvent.click(div);
        expect(onAdd).toHaveBeenCalled();
    });

    it('uses dark variant when theme is dark', () => {
        (useActualTheme as jest.Mock).mockReturnValue('dark');
        render(
            <FavoriteButton
                isFavorite={true}
                onAdd={jest.fn()}
                onRemove={jest.fn()}
            />,
        );
        const div = document.querySelector('[data-tooltip-content="Coin is already in favorites"]') as HTMLElement;
        expect(div).toHaveAttribute('data-tooltip-variant', 'light');
    });
});
