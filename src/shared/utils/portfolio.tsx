import { FiArrowDownLeft } from 'react-icons/fi';
import {
    MdArrowOutward,
    MdOutlineKeyboardDoubleArrowRight,
    MdOutlineSwapHoriz,
} from 'react-icons/md';
import { getCurrentChainByPlatformId } from '../../lib/ChainsUtils';
import { getCustomTokens, isTokenHidden } from '../../lib/customTokens';
import { getDataProvider, MissingApiKeyError } from '../../lib/dataproviders';
import CoinsUtils from '../../lib/CoinsUtils';
import { hideLoadingIndicator, showLoadingIndicator } from '../../store/actions/uiActions';
import { getReduxStore } from '../../store/store';
import Toast from '../../ui/components/Toast';
import { IMPORT_INTERVAL, PAGING_LIMIT } from '../constants/number';
import { PlatformId } from '../types/Chain';
import EventType from '../types/EventType';
import {
    HoldingWallet,
    NFTList,
    Pagination,
    PortfolioCoinHoldings,
    Transaction,
} from '../types/Wallet';
import { getRandomAvatar, getRandomColor } from './avatar';
import eventManager from './eventManager';
import logger from './logger';
import { capitalizeFirstLetter, isEqualCaseInsensitive, toTitleCase } from './string';

let checker: boolean = false;

export const waitFor = (dispatch: Function, seconds: number, callback: Function) => {
    checker = false;
    let fill = 1;
    const interval = seconds * 10;
    dispatch(showLoadingIndicator());

    const intervalId = setInterval(() => {
        fill++;

        if (fill >= 100) {
            clearInterval(intervalId);
            callback();
            checker = true;
        } else {
            dispatch(hideLoadingIndicator());
        }
    }, interval);

    return intervalId;
};

const handleTransactionTokens = (tokens: any[]) => {
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

export const getCoinHoldings = async (
    address: string,
    forceRefresh: boolean,
    platform_id: number,
    showError: boolean = true,
    showHidden: boolean = true,
) => {
    return new Promise<PortfolioCoinHoldings>(async resolve => {
        logger.log('💎 Load coin holdings');

        const store = getReduxStore();
        const allAccounts = store
            ? Object.values(store.getState().globalState.internalAccounts.accounts)
            : [];

        let holdings: any[] | null = null;

        try {
            const provider = getDataProvider(getCurrentChainByPlatformId(platform_id).chain_id);

            const addresses = address
                ? [address]
                : allAccounts
                      .filter((account: any) => !account.metadata?.deleted)
                      .map((account: any) => account.address);

            const results = await Promise.all(
                addresses.map(walletAddress => provider.getTokenHoldings(walletAddress)),
            );
            holdings = results.flat();

            // Merge locally-added custom tokens (balances refresh on-chain)
            const chain = getCurrentChainByPlatformId(platform_id);
            const customTokens = getCustomTokens(chain.chain_id);

            addresses.forEach(walletAddress => {
                customTokens.forEach(token => {
                    const exists = holdings!.some(
                        (item: any) =>
                            isEqualCaseInsensitive(item.token_address, token.address) &&
                            isEqualCaseInsensitive(item.wallet_address, walletAddress),
                    );

                    if (!exists) {
                        holdings!.push({
                            wallet_address: walletAddress.toLowerCase(),
                            wallet_name: '',
                            token_id: `${chain.chain_id}:${token.address.toLowerCase()}`,
                            token_address: token.address.toLowerCase(),
                            balance: 0,
                            balance_usd: 0,
                            platform_id: chain.platform_id,
                            integration_type: 'wallet',
                            avatar: null,
                            coin_name: token.name,
                            logo: token.logo ?? '',
                            symbol: token.symbol,
                            is_custom: true,
                            is_hidden: null,
                            is_verified: false,
                        });
                    }
                });
            });

            // Apply local hidden flags (and honor showHidden)
            holdings.forEach((item: any) => {
                item.is_hidden = isTokenHidden(chain.chain_id, item.token_address);
            });

            if (!showHidden) {
                holdings = holdings.filter((item: any) => !item.is_hidden);
            }

            // Attach wallet names from local accounts
            holdings.forEach((item: any) => {
                const account: any = allAccounts.find((candidate: any) =>
                    isEqualCaseInsensitive(candidate.address, item.wallet_address),
                );
                item.wallet_name = account?.metadata?.name ?? item.wallet_name ?? '';
            });
        } catch (error) {
            logger.error('💎 Load coin holdings failed', error);
            if (showError) {
                const message =
                    error instanceof MissingApiKeyError
                        ? error.message
                        : 'Error occurred while loading portfolio';
                Toast.showError(message);
            }
            holdings = null;
        }

        if (holdings) {
            if (holdings.length) {

                const groupByExchanges: any[] = [];
                let groupByCoins: any[] = [];
                const holdingWallets: HoldingWallet[] = [];
                let _total = 0;

                holdings.forEach((item: any) => {
                    item.avatar = null;

                    const findIndex = allAccounts.findIndex(_account =>
                        isEqualCaseInsensitive(_account.address, item.wallet_address),
                    );

                    if (findIndex >= 0) {
                        item.avatar = allAccounts[findIndex].metadata?.avatar ?? null;
                    } else {
                        const findSmartIndex = allAccounts.findIndex(_wallet =>
                            isEqualCaseInsensitive(_wallet.smartAddress, item.wallet_address),
                        );

                        if (
                            findSmartIndex >= 0 &&
                            allAccounts[findSmartIndex].metadata?.smartAvatar
                        ) {
                            item.avatar = allAccounts[findSmartIndex].metadata?.smartAvatar ?? null;
                        }
                    }

                    if (!item.avatar) {
                        item.avatar = getRandomAvatar(item.wallet_address);
                    }

                    _total += item.balance_usd;
                    const exIndex = groupByExchanges.findIndex(
                        ex =>
                            ex.wallet_address === item.wallet_address &&
                            ex.platform_id === item.platform_id,
                    );

                    if (exIndex !== -1) {
                        groupByExchanges[exIndex].total += item.balance;
                        groupByExchanges[exIndex].totalUSD += item.balance_usd;

                        if (item.token_address) {
                            groupByExchanges[exIndex].items.push({
                                name: '',
                                type: 'coin',
                                ...item,
                            });
                        }
                    } else {
                        const id = item.wallet_address + item.platform_id + item.token_address;
                        groupByExchanges.push({
                            ...item,
                            id,
                            name: item.wallet_name,
                            type: 'exchange',
                            total: item.balance,
                            totalUSD: item.balance_usd,
                            items: item.token_address
                                ? [
                                      {
                                          name: '',
                                          type: 'coin',
                                          ...item,
                                      },
                                  ]
                                : [],
                            color: getRandomColor(item.wallet_address + item.platform_id),
                        });
                    }

                    const coinIndex = groupByCoins.findIndex(
                        coin =>
                            coin.token_address === item.token_address &&
                            coin.platform_id === item.platform_id,
                    );

                    if (coinIndex !== -1) {
                        groupByCoins[coinIndex].total += item.balance;
                        groupByCoins[coinIndex].totalUSD += item.balance_usd;
                        groupByCoins[coinIndex].items.push({
                            name: item.wallet_name,
                            type: 'exchange',
                            ...item,
                        });

                        if (
                            !groupByCoins[coinIndex].multiple_chains &&
                            groupByCoins[coinIndex].platform_id !== item.platform_id
                        ) {
                            groupByCoins[coinIndex].multiple_chains = true;
                        }
                    } else if (item.token_address) {
                        const id = item.token_address + item.wallet_address + item.platform_id;
                        groupByCoins.push({
                            ...item,
                            id,
                            name: '',
                            type: 'coin',
                            total: item.balance,
                            totalUSD: item.balance_usd,
                            items: [
                                {
                                    name: item.wallet_name,
                                    type: 'exchange',
                                    ...item,
                                },
                            ],
                            color: getRandomColor(item.token_address),
                        });
                    }

                    const isNewMenu = holdingWallets.every(
                        menuItem => menuItem.walletAddress !== item.wallet_address,
                    );

                    if (isNewMenu) {
                        holdingWallets.push({
                            walletAddress: item.wallet_address,
                            walletName: item.wallet_name,
                        });
                    }
                });

                const sortCoins = (itemsToSort: any[]) => {
                    itemsToSort.sort((a, b) => {
                        // Prioritize verified tokens (move to top)
                        const aVerified = a.is_verified ? 1 : 0;
                        const bVerified = b.is_verified ? 1 : 0;
                        if (aVerified !== bVerified) {
                            return bVerified - aVerified;
                        }

                        // Then prioritize custom tokens that are not verified (move to top)
                        const aCustom = a.is_custom && !a.is_verified ? 1 : 0;
                        const bCustom = b.is_custom && !b.is_verified ? 1 : 0;
                        if (aCustom !== bCustom) {
                            return bCustom - aCustom;
                        }

                        // Keep original order (sort by balance_usd)
                        return b.balance_usd - a.balance_usd;
                    });
                };

                // Sort group by coins
                if (groupByCoins.length > 1 && address) {
                    const firstItem = groupByCoins[0];
                    const restItems = groupByCoins.slice(1);
                    sortCoins(restItems);
                    groupByCoins = [firstItem, ...restItems];
                } else {
                    sortCoins(groupByCoins);
                }
                groupByCoins.forEach(group => {
                    group.items.sort((a: any, b: any) => {
                        return b.balance_usd - a.balance_usd;
                    });
                });

                // Sort group by wallets
                groupByExchanges.sort((a, b) => {
                    return b.totalUSD - a.totalUSD;
                });
                groupByExchanges.forEach(group => {
                    if (group.items.length > 1) {
                        const firstItem = group.items[0];
                        const restItems = group.items.slice(1);
                        sortCoins(restItems);
                        group.items = [firstItem, ...restItems];
                    } else {
                        sortCoins(group.items);
                    }
                });

                const network = getCurrentChainByPlatformId(platform_id);

                // Put native token first
                const _index = groupByCoins.findIndex(
                    item => item.token_address === network.native_coin_address,
                );

                if (_index > 0) {
                    const _item = groupByCoins[_index];
                    groupByCoins.splice(_index, 1);
                    groupByCoins.unshift(_item);
                }

                const assets = { groupByExchanges, groupByCoins };

                CoinsUtils.updateCoinAssets(assets, newAssets => {
                    resolve({
                        total: _total,
                        empty: false,
                        assets: newAssets,
                        wallets: holdingWallets,
                    });
                });
            } else {
                resolve({
                    total: 0,
                    empty: true,
                    assets: { groupByCoins: [], groupByExchanges: [] },
                    wallets: [],
                });
            }
        } else {
            resolve({
                total: 0,
                empty: true,
                assets: { groupByCoins: [], groupByExchanges: [] },
                wallets: [],
            });
        }
    });
};

export const getNftHoldings = async (
    address: string,
    platform_id: number,
    search: string = '',
    page: number = 1,
): Promise<{ nfts: NFTList[]; pagination: Pagination | null }> => {
    try {
        const provider = getDataProvider(getCurrentChainByPlatformId(platform_id).chain_id);
        return await provider.getNFTs(address, search, page, PAGING_LIMIT);
    } catch (error) {
        logger.error('💎 Load NFT holdings failed', error);
        return { nfts: [], pagination: null };
    }
};

export const getTransactionHistory = async (address: string, platform_id: number, page = 1) => {
    try {
        const provider = getDataProvider(getCurrentChainByPlatformId(platform_id).chain_id);
        const result = await provider.getTransactions(address, page, 10);
        result.data = result.data.map((item: any) => {
            item.tokens = handleTransactionTokens(item.tokens);
            return item;
        });
        return result;
    } catch (error) {
        logger.error('💎 Load transactions failed', error);
        return {
            data: [],
            pagination: {
                page: 1,
                hasNextPage: false,
            },
        };
    }
};

export const getTokenTransactionHistory = async (
    address: string,
    platform_id: number,
    token_address: string,
    page = 1,
) => {
    try {
        const provider = getDataProvider(getCurrentChainByPlatformId(platform_id).chain_id);
        const result = await provider.getTransactions(address, page, 10, token_address);
        result.data = result.data.map((item: any) => {
            item.tokens = handleTransactionTokens(item.tokens);
            return item;
        });
        return result;
    } catch (error) {
        logger.error('💎 Load token transactions failed', error);
        return {
            data: [],
            pagination: {
                page: 1,
                hasNextPage: false,
            },
        };
    }
};

export const getTransactionIcon = (item: any) => {
    const { type, method, tokens, from, wallet_address } = item ?? {};

    switch (type) {
        case 'sell':
            return <MdArrowOutward />;

        case 'swap':
            return <MdOutlineSwapHoriz />;

        case 'buy':
            return <FiArrowDownLeft />;

        case 'transfer':
            switch (method) {
                case 'approve':
                case '0x3289a93e':
                case '0x99eb88c4':
                    return <MdOutlineKeyboardDoubleArrowRight />;
            }

            if (tokens?.length === 1) {
                if (tokens[0].in) {
                    return <FiArrowDownLeft />;
                } else {
                    return <MdArrowOutward />;
                }
            }

            if (method) {
                if (method?.toLowerCase().includes('swap')) {
                    return <MdOutlineSwapHoriz />;
                }

                if (method === 'transfer') {
                    if (wallet_address === from) {
                        return <MdArrowOutward />;
                    } else {
                        return <FiArrowDownLeft />;
                    }
                } else {
                    return <MdOutlineKeyboardDoubleArrowRight />;
                }
            }
            break;

        case 'send':
            if (tokens?.length === 1) {
                if (tokens[0].in) {
                    return <FiArrowDownLeft />;
                } else {
                    return <MdArrowOutward />;
                }
            }
            break;

        case 'pro_deposit':
        case 'exchange_deposit':
            return <MdArrowOutward />;

        case 'pro_withdrawal':
        case 'exchange_withdrawal':
        case 'fiat_deposit':
            return <FiArrowDownLeft />;
    }

    return <MdOutlineKeyboardDoubleArrowRight />;
};

export const getTransactionName = (transaction: Transaction) => {
    const { type, method, tokens, from, wallet_address, success } = transaction;

    if (!success) {
        return toTitleCase(type) + ' Failed';
    }

    if (method?.includes('Chilly')) {
        return method;
    }

    switch (type) {
        case 'transfer':
            switch (method) {
                case 'approve':
                    return toTitleCase(method);

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

    return toTitleCase(type);
};

export const importPortfolioWallet = (
    dispatch: Function,
    address: string,
    platformId: number,
    isChillyWallet: boolean,
    callback: (error: boolean, status: string) => void,
    importOtherChains: boolean = true,
    isSmartWallet: boolean = false,
    otherWalletAddress?: string,
) => {
    // Wallets no longer need backend-side indexing: the data providers read
    // holdings/history directly from free explorer APIs. Report success and
    // ask the UI to refresh.
    logger.log('💎 importPortfolioWallet (local, no backend indexing)', address, platformId);
    dispatch(hideLoadingIndicator());
    eventManager.emit(EventType.REFRESH_WALLET);
    callback(false, 'success');
};
