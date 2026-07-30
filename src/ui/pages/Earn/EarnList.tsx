import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiFillCaretDown } from 'react-icons/ai';
import { useHistory } from 'react-router-dom';
import { getCurrentChains } from '../../../lib/ChainsUtils';
import { DEFAULT_ROUTE, EARN_LIQUID_STAKING_ROUTE } from '../../../shared/constants/routes';
import { EarnItem, StakingType } from '../../../shared/types/Earn';
import { setSelectedNetwork } from '../../../store/actions/uiActions';
import { usePreferences } from '../../../store/selectors';
import { useAppDispatch } from '../../../store/store';
import EarnStakingCard from '../../components/EarnStakingCard';
import Header from '../../components/Header';
import { useEarnData } from './EarnProvider';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const { setLiquidStakingData } = useEarnData();

    const { earnList } = usePreferences();

    const dispatch = useAppDispatch();
    const history = useHistory();
    const [selectedFilter, setSelectedFilter] = useState<number | 'All'>('All');
    const [filterMenuVisible, setFilterMenuVisible] = useState(false);
    const filterMenuRef = useRef<HTMLDivElement>(null);

    // Get unique platformIds from LIST_DATA
    const availablePlatforms = useMemo(() => {
        const platformIds = new Set<number>();
        earnList.forEach(item => {
            if (item.platformId !== undefined && item.platformId !== null) {
                platformIds.add(item.platformId);
            }
        });
        return Array.from(platformIds).sort();
    }, [earnList]);

    // Filter LIST_DATA based on selectedFilter
    const filteredData = useMemo(() => {
        if (selectedFilter === 'All') {
            // Show all items that have platformId
            return earnList.filter(
                item => item.platformId !== undefined && item.platformId !== null,
            );
        }
        // Show only items matching the selected platformId
        return earnList.filter(item => item.platformId === selectedFilter);
    }, [selectedFilter, earnList]);

    // Close filter menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setFilterMenuVisible(false);
            }
        };

        if (filterMenuVisible) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [filterMenuVisible]);

    const onStakingItemPress = useCallback(
        (item: EarnItem) => {
            const network = getCurrentChains().find(c => c.platform_id === item.platformId);
            if (network) {
                dispatch(setSelectedNetwork(network.chain_id));
            }
            setLiquidStakingData(item);
            history.push(EARN_LIQUID_STAKING_ROUTE);
        },
        [history, setLiquidStakingData, dispatch],
    );

    const getPlatformName = useCallback((platformId: number) => {
        const chain = getCurrentChains().find(value => value.platform_id === platformId);

        return chain ? chain.name : '';
    }, []);

    const filterDisplayName = useMemo(() => {
        if (selectedFilter === 'All') {
            return 'All';
        }

        return getPlatformName(selectedFilter);
    }, [getPlatformName, selectedFilter]);

    return (
        <div className="flex flex-col h-full min-h-[400px] relative">
            <Header
                title="Earn"
                action={
                    <div className="relative" ref={filterMenuRef}>
                        <div
                            className={
                                'flex flex-row items-center cursor-pointer text-white px-2 py-1 rounded-md h-[25px] text-xs whitespace-nowrap bg-gray-700'
                            }
                            onClick={() => {
                                setFilterMenuVisible(!filterMenuVisible);
                            }}>
                            <div className="text-nowrap mr-2">{filterDisplayName}</div>
                            <AiFillCaretDown size={12} />
                        </div>
                        {filterMenuVisible && (
                            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 min-w-[150px]">
                                <div
                                    className={`px-3 py-2 text-xs text-white cursor-pointer hover:bg-header ${
                                        selectedFilter === 'All' ? 'bg-gray-700' : ''
                                    }`}
                                    onClick={() => {
                                        setSelectedFilter('All');
                                        setFilterMenuVisible(false);
                                    }}>
                                    All
                                </div>
                                {availablePlatforms.map(platformId => (
                                    <div
                                        key={platformId}
                                        className={`px-3 py-2 text-xs text-white cursor-pointer hover:bg-header ${
                                            selectedFilter === platformId ? 'bg-gray-700' : ''
                                        }`}
                                        onClick={() => {
                                            setSelectedFilter(platformId);
                                            setFilterMenuVisible(false);
                                        }}>
                                        {getPlatformName(platformId)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                }
                onBackPress={() => {
                    history.replace(DEFAULT_ROUTE);
                }}
            />

            <div className="flex flex-col flex-1 p-5 overflow-auto">
                {filteredData
                    .filter(listItem => listItem.stakingType !== StakingType.Yield)
                    .map((listItem, key) => (
                        <EarnStakingCard key={key} data={listItem} onPress={onStakingItemPress} />
                    ))}
            </div>
        </div>
    );
});
