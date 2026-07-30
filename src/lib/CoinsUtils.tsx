/* eslint-disable import/no-anonymous-default-export */
import { MarketRequest, WalletRequest } from '../api/graphQL';
import { CoinLookupResult } from '../api/graphQL/Types';
import { COIN_PRICE_CACHE_INTERVAL } from '../shared/constants/app';
import { PAGING_LIMIT } from '../shared/constants/number';
import { ChainData } from '../shared/types/Chain';
import {
    CachingCoin,
    CoinAssets,
    CoinHoldingGroup,
    CoinPrice,
    PlatformCoin,
} from '../shared/types/Wallet';
import { Images } from '../shared/utils/Images';
import logger from '../shared/utils/logger';
import { capitalizeFirstLetter } from '../shared/utils/string';
import {
    setCachingCoins,
    setNativeCoinPrice,
    setUnknownCoins,
    updatePortfolioCoinsFromBackground,
} from '../store/actions/uiActions';
import { getReduxStore } from '../store/store';

const getCoinsByTokenAddresses = async (
    platformId: number,
    tokenAddresses: string[],
): Promise<CoinPrice> => {
    const store = getReduxStore();
    const cachedPrices = store?.getState().portfolio?.coinPrices[platformId] ?? {};
    const now = Date.now();
    const lowercased = tokenAddresses
        .filter(address => !!address)
        .map(address => address.toLowerCase());

    const freshPrices: CoinPrice = {};

    const staleAddresses = lowercased.filter(address => {
        const cached = cachedPrices[address];

        if (!cached) return true;

        const isStale = now - cached.lastUpdated >= COIN_PRICE_CACHE_INTERVAL;

        if (!isStale) {
            logger.log('💰 Cached Price', address, cached.usdPrice);
            freshPrices[address] = cached;
        }

        return isStale;
    });

    if (staleAddresses.length === 0) {
        return freshPrices;
    }

    const taskList: string[][] = [];
    const MAX_NUM = 15;
    let i = 0;
    let items: string[] = [];

    staleAddresses.forEach(address => {
        if (i < MAX_NUM) {
            i++;
            items.push(address);
        } else {
            taskList.push(items);
            items = [address];
            i = 1;
        }
    });

    if (items.length > 0) {
        taskList.push(items);
    }

    const tasks = taskList.map(addresses => {
        return new Promise<CoinLookupResult[]>(resolve => {
            MarketRequest.getCoinsByTokenAddresses(platformId, addresses)
                .then(async result => {
                    if (result?.data?.coinLookupEx?.length) {
                        resolve(result.data.coinLookupEx);
                    } else {
                        resolve([]);
                    }
                })
                .catch(() => {
                    resolve([]);
                });
        });
    });

    const results = await Promise.all(tasks);
    const flattened = results.flat();
    const priceMap: CoinPrice = { ...freshPrices };

    flattened.forEach(item => {
        const key = item.tokenAddress?.toLowerCase();

        if (key) {
            logger.log('💰 New Price', key, item.usdPrice);
            priceMap[key] = {
                usdPrice: item.usdPrice ?? 0,
                lastUpdated: now,
            };
        }
    });

    staleAddresses.forEach(address => {
        if (!priceMap[address]) {
            priceMap[address] = {
                usdPrice: 0,
                lastUpdated: now,
            };
        }
    });

    return priceMap;
};

const getCoinPrice = async (platformId: number, tokenAddress: string) => {
    if (!platformId || !tokenAddress) {
        return 0;
    }

    const key = tokenAddress.toLowerCase();

    try {
        const result = await getCoinsByTokenAddresses(platformId, [key]);

        return result[key]?.usdPrice ?? 0;
    } catch (_error) {
        logger.log('🔴 Get coin price', _error);
    }

    return 0;
};

export const loadCoins = (
    _name: string,
    _platformId: number,
    callback: (params: { error: boolean; result: PlatformCoin[] }) => void,
) => {
    WalletRequest.getCoinsByPlatformIds(_name, [_platformId], PAGING_LIMIT, 0)
        .then(result => {
            const _platformCoins = result?.data?.platformCoins;

            if (_platformCoins) {
                const { data: _data } = _platformCoins;
                const _coins: PlatformCoin[] = _data;

                callback({ error: false, result: _coins });
            } else {
                callback({
                    error: false,
                    result: [],
                });
            }
        })
        .catch(() => {
            callback({ error: true, result: [] });
        });
};

const getCachingCoins = (
    coinIds: string[],
    callback: (newCachedCoins: CachingCoin[], newUnknownCoins: string[]) => void,
) => {
    // Coin metadata now comes directly from the data providers (logos, names),
    // so there is no separate metadata service to consult. Coins we have no
    // metadata for stay in the unknown list.
    const store = getReduxStore();
    const unknownCoinIds = store?.getState().globalState.unknownCoinIds ?? [];
    const cachingCoins = store?.getState().globalState.cachingCoins ?? [];

    if (coinIds.length) {
        const known = new Set(cachingCoins.map((coin: CachingCoin) => coin.coinId));
        const newUnknown = [...unknownCoinIds];

        coinIds.forEach(id => {
            if (!known.has(id) && !newUnknown.includes(id)) {
                newUnknown.push(id);
            }
        });

        if (newUnknown.length !== unknownCoinIds.length) {
            store?.dispatch(setUnknownCoins(newUnknown));
        }

        callback && callback(cachingCoins, newUnknown);
        return;
    }

    callback && callback(cachingCoins, unknownCoinIds);
};

const updateCoinAssets = (assets: CoinAssets, callback?: (newAssets: CoinAssets) => void) => {
    const addNewFields = async (groups: CoinHoldingGroup[]) => {
        const result: CoinHoldingGroup[] = [];

        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            let group = groups[groupIndex];
            let newGroup = { ...group };
            newGroup.items = [];

            // const imageLogo = newGroup.icon
            //     ? newGroup.icon
            //     : newGroup.logo && !newGroup.logo?.endsWith('/.png')
            //     ? newGroup.logo
            //     : undefined;

            // if (imageLogo) {
            //     try {
            //         const colors = await ImageUtils.getProminentColor(imageLogo);
            //         newGroup.prominentColors = colors;
            //     } catch (error) {
            //         logger.log(error);
            //     }
            // }

            for (let itemIndex = 0; itemIndex < group.items.length; itemIndex++) {
                let newItem = { ...group.items[itemIndex] };

                // const imageLogo2 = newItem.icon
                //     ? newItem.icon
                //     : newItem.logo && !newItem.logo?.endsWith('/.png')
                //     ? newItem.logo
                //     : undefined;

                // if (imageLogo2) {
                //     try {
                //         const colors = await ImageUtils.getProminentColor(imageLogo2);
                //         newItem.prominentColors = colors;
                //     } catch (error) {
                //         logger.log(error);
                //     }
                // }

                newGroup.items.push(newItem);
            }

            result.push(newGroup);
        }

        return result;
    };

    Promise.all([addNewFields(assets.groupByCoins), addNewFields(assets.groupByExchanges)]).then(
        result => {
            callback &&
                callback({
                    groupByCoins: result[0],
                    groupByExchanges: result[1],
                });
        },
    );
};

const handleTokens = (tokens: any[]) => {
    const newTokens: any[] = [];

    tokens &&
        tokens.forEach(token => {
            if (
                newTokens.every(item => {
                    if (item.token_id === token.token_id && item.in === token.in) {
                        item.value = parseFloat(item.value) + parseFloat(token.value);
                        item.usd_value += parseFloat(item.usd_value) + parseFloat(token.usd_value);
                        return false;
                    }

                    return true;
                }) &&
                (token.is_nft || Number(token.value) > 0)
            ) {
                if (token.in) {
                    newTokens.push(token);
                } else {
                    newTokens.unshift(token);
                }
            }
        });

    return newTokens;
};

const getTransactionName = (transaction: any) => {
    const { type, method, tokens, from, wallet_address, success } = transaction;

    if (!success) {
        return type.toTitleCase() + ' Failed';
    }

    if (method?.includes('Chilly')) {
        return method;
    }

    switch (type) {
        case 'transfer':
            switch (method) {
                case 'approve':
                    return method.toTitleCase();

                case '0x3289a93e':
                    return 'Refund Limit Order';

                case '0x99eb88c4':
                    return 'Create Limit Order';
            }

            if (tokens?.length === 1) {
                if (tokens[0].in) {
                    return 'Transfer In';
                } else {
                    return 'Transfer Out';
                }
            }

            if (method) {
                if (method === 'transfer') {
                    if (wallet_address === from) {
                        return 'Transfer Out';
                    } else {
                        return 'Transfer In';
                    }
                } else {
                    let secondName = capitalizeFirstLetter(method);

                    if (method.startsWith('transfer')) {
                        secondName = capitalizeFirstLetter(method.substring(8, method.length));
                    }

                    if (secondName !== 'Swap') {
                        return 'Transfer ' + secondName;
                    } else {
                        return 'Swap';
                    }
                }
            }
            break;

        case 'swap':
            if (method) {
                let secondName = capitalizeFirstLetter(method);

                if (method.startsWith('swap')) {
                    secondName = capitalizeFirstLetter(method.substring(4, method.length));
                }

                return 'Swap ' + secondName;
            }
            break;

        case 'send':
            if (tokens?.length === 1) {
                if (tokens[0].in) {
                    return 'Transfer In';
                } else {
                    return 'Transfer Out';
                }
            }
            break;

        case 'pro_deposit':
        case 'exchange_deposit':
            return 'Withdrawal to Coinbase Pro';

        case 'pro_withdrawal':
        case 'exchange_withdrawal':
            return 'Deposit from Coinbase Pro';

        case 'fiat_deposit':
            return 'Fiat Deposit';

        case 'staking_reward':
            return 'Staking Reward';
    }

    return type.toTitleCase();
};

const getChangedValues = (start: number, end: number) => {
    const value = end - start;
    let percentage =
        start === 0 && end === 0
            ? '0.00%'
            : start !== 0
              ? ((Math.abs(value) / start) * 100).toFixed(2) + '%'
              : 'infinity%';

    return {
        percentage,
        value,
    };
};

const getOpenPriceFromLatestAndPecentage = (latestPrice: number, percentage: number) => {
    return percentage === 0 ? latestPrice : latestPrice / percentage / (0.01 + 1 / percentage);
};

const fetchNativeCoinPrice = async (network: ChainData, callback?: (price: number) => void) => {
    const tokenAddress = network?.native_coin_address;
    const platformId = network?.platform_id;

    if (tokenAddress && platformId) {
        getCoinPrice(platformId, tokenAddress)
            .then(result => {
                getReduxStore()?.dispatch(setNativeCoinPrice(platformId, result));
                callback && callback(result);
            })
            .catch(() => {
                getReduxStore()?.dispatch(setNativeCoinPrice(platformId, 0));
                callback && callback(0);
            });
    } else {
        getReduxStore()?.dispatch(setNativeCoinPrice(platformId ?? 0, 0));
        callback && callback(0);
    }
};

const fetchPortfolioCoins = async (address: string, network?: ChainData) => {
    network = network ?? getReduxStore()?.getState().globalState.selectedNetwork;
    if (network) {
        getReduxStore()?.dispatch(
            updatePortfolioCoinsFromBackground(address, network.platform_id),
        );
    }
};

export default {
    loadCoins,
    getCachingCoins,
    updateCoinAssets,
    handleTokens,
    getTransactionName,
    getChangedValues,
    getOpenPriceFromLatestAndPecentage,
    fetchNativeCoinPrice,
    fetchPortfolioCoins,
    getCoinsByTokenAddresses,
    getCoinPrice,
};
