import React, { useCallback, useEffect } from 'react';
import { DEFAULT_LAUNCHER_ICON_KEY, LAUNCHER_ICONS } from '../../shared/utils/Images';
import { usePreferences } from '../../store/selectors';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const { appIcon } = usePreferences();

    const changeIcon = useCallback((src: string) => {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            // @ts-ignore
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
        }
        // @ts-ignore
        link.href = src;
    }, []);

    useEffect(() => {
        if (appIcon) {
            // An icon picked before the rebrand no longer exists — fall back to the default.
            const iconObj =
                LAUNCHER_ICONS.find(icon => icon.key === appIcon) ??
                LAUNCHER_ICONS.find(icon => icon.key === DEFAULT_LAUNCHER_ICON_KEY);
            if (iconObj) {
                // @ts-ignore
                chrome.action.setIcon({ path: iconObj.path });

                changeIcon(iconObj.path);
            }
        }
    }, [appIcon, changeIcon]);

    return <></>;
});
