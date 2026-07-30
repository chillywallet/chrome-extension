import { createMemoryHistory } from 'history';
import React from 'react';
import { render } from '@testing-library/react';
import { Router } from 'react-router-dom';

import Lock from '../../../src/ui/pages/Lock';
import { DEFAULT_ROUTE } from '../../../src/shared/constants/routes';
import { useIsUnlocked } from '../../../src/store/selectors';

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/selectors', () => ({
    ...jest.requireActual('../../../src/store/selectors'),
    useIsUnlocked: jest.fn(),
}));

function setup() {
    const history = createMemoryHistory({ initialEntries: ['/lock'] });
    const replaceSpy = jest.spyOn(history, 'replace');
    const view = render(
        <Router history={history}>
            <Lock />
        </Router>,
    );
    return { ...view, history, replaceSpy };
}

describe('Lock', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('dispatches lockApp thunk when unlocked', () => {
        jest.mocked(useIsUnlocked).mockReturnValue(true);
        const { replaceSpy } = setup();

        expect(mockDispatch).toHaveBeenCalledTimes(1);
        expect(typeof mockDispatch.mock.calls[0][0]).toBe('function');
        expect(replaceSpy).not.toHaveBeenCalled();
    });

    it('replaces to DEFAULT_ROUTE when already locked', () => {
        jest.mocked(useIsUnlocked).mockReturnValue(false);
        const { replaceSpy } = setup();

        expect(replaceSpy).toHaveBeenCalledWith(DEFAULT_ROUTE);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('renders spinner overlay', () => {
        jest.mocked(useIsUnlocked).mockReturnValue(true);
        const { container } = setup();

        expect(container.querySelector('svg.custom-anim-fast')).toBeTruthy();
        expect(container.querySelector('.flex.justify-center.items-center')).toBeTruthy();
    });
});
