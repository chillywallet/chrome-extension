import React from 'react';
import Header from '../components/Header';
import ExploreTab from './Home/ExploreTab';

/**
 * Explore as a standalone destination. It used to be one of two panels behind the
 * old bottom tab bar; the nav now holds Home / Swap / Activity / Settings, so this
 * is reached from the chart icon in the Home top bar.
 */
export default React.memo(() => {
    return (
        <div className="flex flex-col h-full min-h-0">
            <Header title="Explore" />
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <ExploreTab />
            </div>
        </div>
    );
});
