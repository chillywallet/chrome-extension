import React, { useCallback, useEffect } from 'react';

import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { ExploreTabType } from '../../../shared/types/Home';
import { setDefaultExploreTab, setExploreRedDot } from '../../../store/actions/uiActions';
import { usePreferences } from '../../../store/selectors';
import { useAppDispatch } from '../../../store/store';
import { useRoutesData } from '../RoutesProvider';
import ExploreTabCoins from './Explore/ExploreTabCoins';
import ExploreTabMain from './Explore/ExploreTabMain';
import { HomeProps } from './Home';

type Props = HomeProps & {};

const ExploreTab = React.memo<Props>((props: Props) => {
    const { exploreTabIndex, setExploreTabIndex } = useRoutesData();
    const dispatch = useAppDispatch();
    const { exploreRedDot } = usePreferences();

    const onTabPress = useCallback(
        (index: number) => {
            setExploreTabIndex(index);

            switch (index) {
                case 0:
                    dispatch(setDefaultExploreTab(ExploreTabType.Main));
                    break;

                case 1:
                    dispatch(setDefaultExploreTab(ExploreTabType.Coin));
                    break;
            }
        },
        [dispatch, setExploreTabIndex],
    );

    useEffect(() => {
        if (exploreRedDot) {
            dispatch(setExploreRedDot(false));
        }
    }, [dispatch, exploreRedDot]);

    return (
        <div className={'flex flex-col flex-1 bg-slate-50 dark:bg-dark'}>
            <Tabs
                onSelect={onTabPress}
                selectedIndex={exploreTabIndex}
                selectedTabClassName="tab-selected-tab-class-name"
                selectedTabPanelClassName="tab-selected-tab-panel-class-name"
                className="tab-class-name dark:bg-dark">
                <TabList className="tab-tablist">
                    <Tab className="tab-tablist-tab">Explore</Tab>
                    <Tab className="tab-tablist-tab">Coins</Tab>
                </TabList>

                <TabPanel>
                    <ExploreTabMain />
                </TabPanel>
                <TabPanel>
                    <ExploreTabCoins />
                </TabPanel>
            </Tabs>
        </div>
    );
});

export default ExploreTab;
