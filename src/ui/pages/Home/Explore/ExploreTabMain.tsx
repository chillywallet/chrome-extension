import React, { useCallback, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { SEARCH_LIST_ROUTE } from '../../../../shared/constants/routes';
import { FavoriteLink } from '../../../../shared/types/Home';
import { Images } from '../../../../shared/utils/Images';
import { useRemoteFavoriteLinks } from '../../../../store/selectors';
import BlockchainExplorerModal from '../../../components/BlockchainExplorerModal';

type Props = {};

const ExploreTabMain = React.memo<Props>((props: Props) => {
    const history = useHistory();
    const remoteFavoriteLinks = useRemoteFavoriteLinks();
    const [showExplorerModal, setShowExplorerModal] = useState(false);

    const favoriteList = useMemo(() => {
        const result: FavoriteLink[] = [...remoteFavoriteLinks];
        result.push({
            name: 'Blockchain Explorer',
            link: '',
            logo: Images.logoEtherscanLight,
            darkLogo: Images.logoEtherscanDark,
            category: 'favorites',
        });
        return result;
    }, [remoteFavoriteLinks]);

    const groupedFavorites = useMemo(() => {
        const groups: { [key: string]: FavoriteLink[] } = {};
        const orderedSections: string[] = [];

        // Separate items by category
        const trendingItems: FavoriteLink[] = [];
        const favoritesItems: FavoriteLink[] = [];
        const categorizedItems: { [key: string]: FavoriteLink[] } = {};
        const othersItems: FavoriteLink[] = [];

        favoriteList.forEach(item => {
            if (item.category === 'Trending') {
                trendingItems.push(item);
            } else if (item.category === 'favorites') {
                favoritesItems.push(item);
            } else if (
                item.category &&
                item.category !== 'Trending' &&
                item.category !== 'favorites'
            ) {
                if (!categorizedItems[item.category]) {
                    categorizedItems[item.category] = [];
                }
                categorizedItems[item.category].push(item);
            } else {
                othersItems.push(item);
            }
        });

        // Add sections in the specified order
        if (trendingItems.length > 0) {
            groups['Trending'] = trendingItems;
            orderedSections.push('Trending');
        }

        if (favoritesItems.length > 0) {
            groups['Favorites'] = favoritesItems;
            orderedSections.push('Favorites');
        }

        // Add other categories
        Object.keys(categorizedItems).forEach(category => {
            const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
            groups[categoryName] = categorizedItems[category];
            orderedSections.push(categoryName);
        });

        if (othersItems.length > 0) {
            groups['Running Hot'] = othersItems;
            orderedSections.push('Running Hot');
        }

        return { groups, orderedSections };
    }, [favoriteList]);

    const scrollClass = 'h-[calc(100vh-139px)] sm:h-[calc(100vh-40px-139px)]';

    const onFavoriteItemPress = useCallback((item: FavoriteLink) => {
        if (item.name === 'Blockchain Explorer') {
            setShowExplorerModal(true);
        } else {
            global.platform.openLink(item.link, '_blank');
        }
    }, []);

    const renderFavoriteItem = useCallback(
        (item: FavoriteLink, index: number) => (
            <div
                key={item.name + index}
                className="rounded-2xl bg-white dark:bg-dark border border-slate-200 dark:border-darkline/60 hover:border-primary/50 dark:hover:border-accent/50 p-3 flex flex-row items-center cursor-pointer text-sm overflow-hidden transition-colors"
                onClick={() => {
                    onFavoriteItemPress(item);
                }}>
                {item.darkLogo ? (
                    <>
                        <img
                            src={item.logo}
                            className="block dark:hidden w-8 h-8 mr-3"
                            alt="logo"
                        />
                        <img
                            src={item.darkLogo}
                            className="hidden dark:block w-8 h-8 mr-3"
                            alt="logo"
                        />
                    </>
                ) : (
                    <img src={item.logo} className="block w-8 h-8 mr-3" alt="logo" />
                )}
                {item.name}
            </div>
        ),
        [onFavoriteItemPress],
    );

    return (
        <div className={'p-5 overflow-y-auto ' + scrollClass}>
            <div
                className="text-sm rounded-xl bg-slate-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 cursor-pointer p-3 mb-3"
                onClick={() => {
                    history.push(SEARCH_LIST_ROUTE);
                }}>
                Search or Type URL
            </div>
            <div className="mt-2">
                {groupedFavorites.orderedSections.map(sectionName => {
                    const items = groupedFavorites.groups[sectionName];

                    return (
                        <div key={sectionName} className="mb-4">
                            <div className="flex flex-row items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {sectionName}
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                {items.map((item, index) => renderFavoriteItem(item, index))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <BlockchainExplorerModal
                visible={showExplorerModal}
                onClose={() => {
                    setShowExplorerModal(false);
                }}
            />
        </div>
    );
});

export default ExploreTabMain;
