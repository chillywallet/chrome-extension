import React, { useEffect } from 'react';
import { STATIC_REMOTE_DATA } from '../../config';
import logger from '../../shared/utils/logger';
import { setRemoteData } from '../../store/actions/uiActions';
import { useAppDispatch } from '../../store/store';

type Props = {};

/**
 * Replaces the former FirebaseHandler (remote config + push notifications).
 * Applies the committed static configuration from src/config on startup via
 * the same `setRemoteData` action, so all downstream preference plumbing is
 * unchanged.
 */
export default React.memo<Props>((props: Props) => {
    const dispatch = useAppDispatch();

    useEffect(() => {
        dispatch(setRemoteData(STATIC_REMOTE_DATA)).catch((error: unknown) => {
            logger.error('StaticConfigHandler: failed to apply static config', error);
        });
    }, [dispatch]);

    return <></>;
});
