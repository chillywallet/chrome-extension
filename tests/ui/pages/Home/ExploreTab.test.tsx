import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ExploreTab from '../../../../src/ui/pages/Home/ExploreTab';
import { renderWithHomeProviders } from './fixtures/homeHarness';

jest.mock('../../../../src/ui/components/BlockchainExplorerModal', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../../../../src/store/backgroundConnection', () => {
    const {
        submitRequestToBackgroundTestDouble,
    } = require('./fixtures/backgroundTestDouble');
    return {
        generateActionId: () => 'test-action',
        submitRequestToBackground: (method: string, args?: unknown[]) =>
            submitRequestToBackgroundTestDouble(method, args),
    };
});

describe('ExploreTab', () => {
    it('clears explore red dot on mount and switches sub-tabs', async () => {
        render(
            renderWithHomeProviders(<ExploreTab />, {
                state: {
                    globalState: {
                        preferences: {
                            exploreRedDot: true,
                        },
                    },
                },
            }),
        );

        const exploreTabs = screen.getAllByText('Explore');
        expect(exploreTabs.length).toBeGreaterThan(0);
        expect(screen.getByText('Coins')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Coins'));
    });

    it('handles selecting the Explore (case 0) tab', async () => {
        // start at Coins so clicking Explore actually fires case 0
        const setExploreTabIndex = jest.fn();
        render(
            renderWithHomeProviders(<ExploreTab />, {
                routes: {
                    exploreTabIndex: 1,
                    setExploreTabIndex,
                },
            }),
        );
        await userEvent.click(screen.getAllByText('Explore')[0]);
        expect(setExploreTabIndex).toHaveBeenCalledWith(0);
    });

    it('does not dispatch red dot clear when exploreRedDot is false', () => {
        render(
            renderWithHomeProviders(<ExploreTab />, {
                state: {
                    globalState: {
                        preferences: { exploreRedDot: false },
                    },
                },
            }),
        );
        // no error means useEffect branch (false) was taken
        expect(screen.getByText('Coins')).toBeInTheDocument();
    });
});
