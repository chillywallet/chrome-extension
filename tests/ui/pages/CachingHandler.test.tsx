import React from 'react';
import { render, waitFor } from '@testing-library/react';

import logger from '../../../src/shared/utils/logger';
import CoinsUtils from '../../../src/lib/CoinsUtils';
import { setTopCoinsByNetwork } from '../../../src/store/actions/uiActions';
import CachingHandler from '../../../src/ui/pages/CachingHandler';

const selectors = {
    platformId: 1,
    unknownCoinIds: ['unknown-1'],
};

const mockDispatch = jest.fn();

jest.mock('../../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn() },
}));

jest.mock('../../../src/store/store', () => ({
    __esModule: true,
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/selectors/wallet', () => ({
    ...jest.requireActual('../../../src/store/selectors/wallet'),
    useCurrentPlatformId: () => selectors.platformId,
}));

jest.mock('../../../src/store/selectors/coin', () => ({
    ...jest.requireActual('../../../src/store/selectors/coin'),
    useUnknownCoinIds: () => selectors.unknownCoinIds,
}));

jest.mock('../../../src/store/actions/uiActions', () => {
    const actual = jest.requireActual('../../../src/store/actions/uiActions');
    return {
        ...actual,
        setTopCoinsByNetwork: jest.fn(() => jest.fn()),
    };
});

jest.mock('../../../src/lib/CoinsUtils', () => ({
    __esModule: true,
    default: {
        loadCoins: jest.fn(),
        getCachingCoins: jest.fn(),
    },
}));

describe('CachingHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        selectors.platformId = 1;
        selectors.unknownCoinIds = ['unknown-1'];

        mockDispatch.mockImplementation((action: unknown) =>
            typeof action === 'function'
                ? (action as (d: typeof mockDispatch, s: () => unknown) => unknown)(
                      mockDispatch,
                      () => ({}),
                  )
                : action,
        );

        jest.mocked(CoinsUtils.loadCoins).mockImplementation((_, __, cb) => {
            cb({ error: false, result: [{ id: 1 }] as unknown[] });
            return undefined;
        });
        jest.mocked(CoinsUtils.getCachingCoins).mockImplementation((_ids, cb) => {
            (cb as () => void)();
        });
    });

    it('returns null', () => {
        const { container } = render(<CachingHandler />);
        expect(container.firstChild).toBeNull();
    });

    it('loads top coins and dispatches when loadCoins succeeds with results', () => {
        render(<CachingHandler />);
        expect(CoinsUtils.loadCoins).toHaveBeenCalledWith('', 1, expect.any(Function));
        expect(setTopCoinsByNetwork).toHaveBeenCalledWith(1, [{ id: 1 }]);
        expect(logger.log).toHaveBeenCalledWith('Load Top Coins By Current Network', 1);
    });

    it('does not dispatch top coins when loadCoins reports an error', () => {
        jest.mocked(CoinsUtils.loadCoins).mockImplementation((_, __, cb) => {
            cb({ error: true, result: [] });
            return undefined;
        });
        render(<CachingHandler />);
        expect(setTopCoinsByNetwork).not.toHaveBeenCalled();
    });

    it('does not dispatch top coins when loadCoins returns an empty list', () => {
        jest.mocked(CoinsUtils.loadCoins).mockImplementation((_, __, cb) => {
            cb({ error: false, result: [] });
            return undefined;
        });
        render(<CachingHandler />);
        expect(setTopCoinsByNetwork).not.toHaveBeenCalled();
    });


    it('calls getCachingCoins with the unknown ids', () => {
        render(<CachingHandler />);
        expect(CoinsUtils.getCachingCoins).toHaveBeenCalledWith(['unknown-1'], expect.any(Function));
    });






});
