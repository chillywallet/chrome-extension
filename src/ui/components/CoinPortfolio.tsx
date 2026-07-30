import React, { useEffect, useRef, useState } from 'react';
import { Coin } from '../../shared/types/Wallet';
import { usePortfolioCoins } from '../../store/selectors';
import { useWalletData } from '../pages/Home/WalletProvider';
import CoinCard, { Placeholder } from './CoinCard';

type Props = {
    onCoinPress: (coin: Coin, isAAWallet: boolean) => void;
    walletAddress: string;
    isAAWallet?: boolean;
};

export default React.memo<Props>((props: Props) => {
    const { onCoinPress, walletAddress, isAAWallet = false } = props;
    const portfolioCoins = usePortfolioCoins(walletAddress);
    const {
        showAllCoins,
        setShowAllCoins,
        onShowMoreCoins,
        onShowLessCoins,
        filteredCoins,
        hasHiddenCoins,
    } = useWalletData();

    const [isLoading, setIsLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsLoading(portfolioCoins.length === 0);
    }, [portfolioCoins]);

    useEffect(() => {
        const findScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
            if (!element) return null;

            const style = window.getComputedStyle(element);
            const isScrollable =
                style.overflowY === 'auto' ||
                style.overflowY === 'scroll' ||
                style.overflow === 'auto' ||
                style.overflow === 'scroll';

            if (isScrollable && element.scrollHeight > element.clientHeight) {
                return element;
            }

            return findScrollableParent(element.parentElement);
        };

        const container = findScrollableParent(containerRef.current);
        if (!container) return;

        const handleScroll = () => {
            if (container.scrollTop === 0 && showAllCoins) {
                setShowAllCoins(false);
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [showAllCoins, setShowAllCoins]);

    return (
        <div ref={containerRef} className={'divide-y dark:divide-darker'}>
            {isLoading ? (
                [...Array(5)].map((_, index) => <Placeholder key={index} />)
            ) : filteredCoins.length ? (
                <>
                    {filteredCoins.map(_coin => (
                        <CoinCard
                            key={_coin.id}
                            data={_coin}
                            onPress={() => onCoinPress(_coin, isAAWallet)}
                            isAAWallet={isAAWallet}
                            type="portfolio"
                        />
                    ))}
                    {hasHiddenCoins && (
                        <div className="flex justify-center py-4">
                            {showAllCoins ? (
                                <button
                                    className="text-primary text-sm font-medium hover:underline"
                                    onClick={onShowLessCoins}>
                                    Show Less
                                </button>
                            ) : (
                                <button
                                    className="text-primary text-sm font-medium hover:underline"
                                    onClick={onShowMoreCoins}>
                                    Show All ({portfolioCoins.length - filteredCoins.length} more)
                                </button>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <div className="flex items-center h-full justify-center text-sm text-gray-400 text-center">
                    There are no coins.
                </div>
            )}
        </div>
    );
});
