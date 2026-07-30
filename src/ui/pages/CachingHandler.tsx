import React, { useCallback, useEffect } from 'react';
import CoinsUtils from '../../lib/CoinsUtils';
import logger from '../../shared/utils/logger';
import { setTopCoinsByNetwork } from '../../store/actions/uiActions';
import { useUnknownCoinIds } from '../../store/selectors/coin';
import { useCurrentPlatformId } from '../../store/selectors/wallet';
import { useAppDispatch } from '../../store/store';

type Props = {};

export default React.memo<Props>(() => {
    const platformId = useCurrentPlatformId();
    const unknownCoinIds = useUnknownCoinIds();
    const dispatch = useAppDispatch();

    const loadTopCoinsByCurrentNetwork = useCallback(() => {
        CoinsUtils.loadCoins('', platformId, ({ error, result }) => {
            if (!error && result.length) {
                dispatch(setTopCoinsByNetwork(platformId, result));
                logger.log('Load Top Coins By Current Network', platformId);
            }
        });
    }, [dispatch, platformId]);

    useEffect(() => {
        loadTopCoinsByCurrentNetwork();
    }, [loadTopCoinsByCurrentNetwork]);

    useEffect(() => {
        CoinsUtils.getCachingCoins(unknownCoinIds, () => {});
    }, [unknownCoinIds]);

    return null;
});
