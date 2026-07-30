import React, { useCallback, useMemo } from 'react';
import { IconType } from 'react-icons';
import { MdHistory, MdHome, MdOutlineSettings, MdSwapVert } from 'react-icons/md';
import { useHistory, useLocation } from 'react-router-dom';
import {
    ACTIVITY_ROUTE,
    DEFAULT_ROUTE,
    SETTINGS_ROUTE,
    SWAP_ROUTE,
} from '../../shared/constants/routes';

type NavItem = {
    id: string;
    label: string;
    icon: IconType;
    route: string;
};

const NAV_ITEMS: NavItem[] = [
    { id: 'home', label: 'Home', icon: MdHome, route: DEFAULT_ROUTE },
    { id: 'swap', label: 'Swap', icon: MdSwapVert, route: SWAP_ROUTE },
    { id: 'activity', label: 'Activity', icon: MdHistory, route: ACTIVITY_ROUTE },
    { id: 'settings', label: 'Settings', icon: MdOutlineSettings, route: SETTINGS_ROUTE },
];

/**
 * Persistent bottom navigation for the four top-level destinations. Rendered by
 * each destination page rather than by the router, so deeper screens (send flow,
 * coin detail, confirmations) stay full-height without it.
 */
export default React.memo(() => {
    const history = useHistory();
    const location = useLocation();

    const activeId = useMemo(() => {
        const path = location.pathname;
        // Longest match first so '/' does not win over the others.
        const match = [...NAV_ITEMS]
            .filter(item => item.route !== DEFAULT_ROUTE)
            .find(item => path.startsWith(item.route));

        return match ? match.id : 'home';
    }, [location.pathname]);

    const onPress = useCallback(
        (item: NavItem) => {
            if (item.route === location.pathname) {
                return;
            }
            history.push(item.route);
        },
        [history, location.pathname],
    );

    return (
        <nav
            aria-label="Main"
            className="shrink-0 flex flex-row items-center justify-around w-full h-14 px-2 bg-white/85 dark:bg-darker/85 backdrop-blur-md border-t border-slate-200 dark:border-darkline">
            {NAV_ITEMS.map(item => {
                const active = activeId === item.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        data-testid={`nav-${item.id}`}
                        aria-current={active ? 'page' : undefined}
                        aria-label={item.label}
                        className={
                            'flex flex-1 flex-col items-center justify-center h-full gap-0.5 rounded-xl transition-colors focus:outline-none ' +
                            (active
                                ? 'text-primary dark:text-accent'
                                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300')
                        }
                        onClick={() => onPress(item)}>
                        <item.icon size={21} />
                        <span className={'text-[10px] leading-none ' + (active ? 'font-semibold' : '')}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
});
