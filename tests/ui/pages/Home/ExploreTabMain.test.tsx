import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import ExploreTabMain from '../../../../src/ui/pages/Home/Explore/ExploreTabMain';
import { renderWithHomeProviders } from './fixtures/homeHarness';

const mockHistoryPush = jest.fn();

jest.mock('react-router-dom', () => {
    const actual = jest.requireActual('react-router-dom');
    return {
        ...actual,
        useHistory: () => ({ push: mockHistoryPush }),
    };
});

jest.mock('../../../../src/ui/components/BlockchainExplorerModal', () => ({
    __esModule: true,
    default: ({ visible, onClose }: any) =>
        visible ? (
            <div data-testid="explorer-modal">
                <button data-testid="explorer-modal-onclose" onClick={onClose}>
                    close-explorer
                </button>
            </div>
        ) : null,
}));

describe('ExploreTabMain', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global as any).platform = { openLink: jest.fn() };
    });

    it('renders the search bar and navigates to search on click', () => {
        render(renderWithHomeProviders(<ExploreTabMain />));

        fireEvent.click(screen.getByText('Search or Type URL'));
        expect(mockHistoryPush).toHaveBeenCalled();
    });

    it('renders the Blockchain Explorer favorite and opens the modal', () => {
        render(renderWithHomeProviders(<ExploreTabMain />));

        fireEvent.click(screen.getByText('Blockchain Explorer'));
        expect(screen.getByTestId('explorer-modal')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('explorer-modal-onclose'));
        expect(screen.queryByTestId('explorer-modal')).not.toBeInTheDocument();
    });

    it('groups favorites under the Favorites section', () => {
        render(renderWithHomeProviders(<ExploreTabMain />));
        expect(screen.getByText('Favorites')).toBeInTheDocument();
    });
});
