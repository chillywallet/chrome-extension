import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import Reload from '../../../src/ui/pages/Reload';

jest.mock('webextension-polyfill', () => {
    const mockRuntimeReload = jest.fn();
    return {
        __esModule: true,
        default: {
            runtime: {
                reload: mockRuntimeReload,
            },
        },
    };
});

const getBrowserReload = () =>
    jest.requireMock('webextension-polyfill').default.runtime.reload as jest.Mock;

describe('Reload', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        getBrowserReload().mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders error copy and the reload affordance', () => {
        const { container } = render(<Reload />);

        expect(
            screen.getByText(/Chilly encountered an unexpected issue/i),
        ).toBeInTheDocument();

        expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();

        const logo = container.querySelector('img');
        expect(logo).not.toBeNull();
        expect(logo).toHaveAttribute('loading', 'lazy');
    });

    it('calls Browser.runtime.reload after a short delay when Reload is clicked', () => {
        render(<Reload />);

        fireEvent.click(screen.getByRole('button', { name: /reload/i }));

        expect(getBrowserReload()).not.toHaveBeenCalled();

        jest.advanceTimersByTime(499);
        expect(getBrowserReload()).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(getBrowserReload()).toHaveBeenCalledTimes(1);
    });

    it('does not eagerly reload again before further clicks add more timers', () => {
        render(<Reload />);

        jest.advanceTimersByTime(600);
        expect(getBrowserReload()).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /reload/i }));
        jest.advanceTimersByTime(500);
        expect(getBrowserReload()).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: /reload/i }));
        jest.advanceTimersByTime(500);
        expect(getBrowserReload()).toHaveBeenCalledTimes(2);
    });
});
