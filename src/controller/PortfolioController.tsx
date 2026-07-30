import { RestrictedControllerMessenger } from '@metamask/base-controller';
import { ObservableStore } from '@metamask/obs-store';
import { JsonRpcProvider } from 'ethers';
import {
    CachingCoin,
    Coin,
    CoinPrice,
    CoinPrices,
    PendingTransaction,
    TxtStatus,
} from '../shared/types/Wallet';
import logger from '../shared/utils/logger';

const controllerName = 'PortfolioController';

export type PortfolioControllerNewAddressesEvent = {
    type: `${typeof controllerName}:newAddress`;
    payload: [string];
};

export type PortfolioControllerGetPortfolioCoinsAction = {
    type: `${typeof controllerName}:getPortfolioCoins`;
    handler: PortfolioController['getPortfolioCoins'];
};

export type PortfolioControllerActions = PortfolioControllerGetPortfolioCoinsAction;

export type PortfolioControllerEvents = PortfolioControllerNewAddressesEvent;

export type PortfolioControllerState = {
    nativeCoinPrices: Record<number, number>;
    portfolioCoins: Record<string, Record<number, Coin[]>>;
    coinPrices: CoinPrices;
    pendingTransactions: Record<string, Record<number, PendingTransaction[]>>;
    cachingCoins: CachingCoin[];
    unknownCoinIds: string[];
};

const defaultState: PortfolioControllerState = {
    nativeCoinPrices: {},
    portfolioCoins: {},
    coinPrices: {},
    pendingTransactions: {},
    cachingCoins: [],
    unknownCoinIds: [],
};

export type PortfolioControllerMessenger = RestrictedControllerMessenger<
    typeof controllerName,
    PortfolioControllerActions,
    PortfolioControllerEvents,
    never,
    never
>;

type Props = {
    state: PortfolioControllerState;
    getProviderByPlatformId: (platformId: number) => JsonRpcProvider;
    messagingSystem: PortfolioControllerMessenger;
};

export default class PortfolioController {
    store: ObservableStore<PortfolioControllerState>;
    #getProviderByPlatformId: (platformId: number) => JsonRpcProvider;
    messagingSystem: PortfolioControllerMessenger;
    #pendingTxStatusTasks: Map<string, Promise<TxtStatus>> = new Map();

    constructor(opts: Props) {
        const initState = {
            ...defaultState,
            ...opts.state,
        };

        this.store = new ObservableStore(initState);
        this.#getProviderByPlatformId = opts.getProviderByPlatformId;
        this.messagingSystem = opts.messagingSystem;

        this.#registerMessageHandlers();
    }

    clearState() {
        this.store.updateState({
            ...defaultState,
        });
    }

    setUnknownCoins(coinIds: string[]) {
        this.store.updateState({
            unknownCoinIds: coinIds,
        });
    }

    setCachingCoins(cachingCoins: CachingCoin[]) {
        this.store.updateState({
            cachingCoins,
        });
    }

    setNativeCoinPrice(platformId: number, price: number) {
        const { nativeCoinPrices } = this.store.getState();
        this.store.updateState({
            nativeCoinPrices: {
                ...nativeCoinPrices,
                [platformId]: price,
            },
        });
    }

    getPortfolioCoins() {
        const { portfolioCoins } = this.store.getState();
        return portfolioCoins;
    }

    getCurrentPortfolioCoins(address: string, platformId: number) {
        const { portfolioCoins } = this.store.getState();
        return portfolioCoins[address]?.[platformId] ?? [];
    }

    getCurrentCoinPrices(platformId: number) {
        const { coinPrices } = this.store.getState();
        return coinPrices[platformId] ?? {};
    }

    getCoinByTokenAddress(
        address: string,
        platformId: number,
        tokenAddress: string,
    ): Coin | undefined {
        const coins = this.getCurrentPortfolioCoins(address.toLowerCase(), platformId);
        if (!coins || coins.length === 0 || !tokenAddress) {
            return undefined;
        }

        const normalizedTokenAddress = tokenAddress.toLowerCase();
        return coins.find(coin => coin.token_address?.toLowerCase() === normalizedTokenAddress);
    }

    setPortfolioCoins(address: string, platformId: number, coins: Coin[]) {
        const { portfolioCoins } = this.store.getState();

        const existingCoins: Coin[] = portfolioCoins[address]?.[platformId] ?? [];
        const isNewAddress = !portfolioCoins[address];

        if (existingCoins.length > 0 && coins && coins.length > 0) {
            const byTokenAddress = new Map<string, Coin>();

            existingCoins.forEach(c => {
                if (c.token_address) {
                    byTokenAddress.set(c.token_address.toLowerCase(), c);
                }
            });

            const newCoins: Coin[] = [];

            coins.forEach(coin => {
                const key = coin.token_address ? coin.token_address.toLowerCase() : '';
                const cached = (key && byTokenAddress.get(key)) || undefined;

                if (!cached) {
                    newCoins.push(coin);
                    return;
                }

                const merged: Coin = { ...coin };

                if (
                    (merged.coin_balance === undefined || merged.coin_balance === null) &&
                    cached.coin_balance !== undefined
                ) {
                    merged.coin_balance = cached.coin_balance;
                }

                if (
                    (merged.coin_price === undefined || merged.coin_price === null) &&
                    cached.coin_price !== undefined
                ) {
                    merged.coin_price = cached.coin_price;
                }

                newCoins.push(merged);
            });

            coins = newCoins;
        }

        this.store.updateState({
            portfolioCoins: {
                ...portfolioCoins,
                [address]: {
                    ...portfolioCoins[address],
                    [platformId]: coins,
                },
            },
        });

        if (isNewAddress) {
            this.messagingSystem.publish(`${controllerName}:newAddress`, address);
        }
    }

    updatePortfolioCoins(address: string, platformId: number, coins: Coin[]) {
        const { portfolioCoins } = this.store.getState();
        const existingCoins: Coin[] = portfolioCoins[address]?.[platformId] ?? [];

        if (existingCoins.length > 0 && coins && coins.length > 0) {
            // Update existing coins with new balance and price data
            const updatedCoins = existingCoins.map(existingCoin => {
                const updatedCoin = coins.find(
                    coin =>
                        coin.wallet_address === existingCoin.wallet_address &&
                        coin.token_address === existingCoin.token_address &&
                        coin.platform_id === existingCoin.platform_id,
                );

                if (updatedCoin) {
                    // Update balance and price if they exist in the updated coin
                    return {
                        ...existingCoin,
                        coin_balance:
                            updatedCoin.coin_balance !== undefined
                                ? updatedCoin.coin_balance
                                : existingCoin.coin_balance,
                        coin_price:
                            updatedCoin.coin_price !== undefined
                                ? updatedCoin.coin_price
                                : existingCoin.coin_price,
                    };
                }

                return existingCoin;
            });

            this.store.updateState({
                portfolioCoins: {
                    ...portfolioCoins,
                    [address]: {
                        ...portfolioCoins[address],
                        [platformId]: updatedCoins,
                    },
                },
            });
        }
    }

    setCoinPrices(platformId: number, data: CoinPrice) {
        const { coinPrices } = this.store.getState();
        this.store.updateState({
            coinPrices: {
                ...coinPrices,
                [platformId]: {
                    ...coinPrices[platformId],
                    ...data,
                },
            },
        });
    }

    setPendingTransactions(
        address: string,
        platformId: number,
        transactions: PendingTransaction[],
    ) {
        const { pendingTransactions } = this.store.getState();
        this.store.updateState({
            pendingTransactions: {
                ...pendingTransactions,
                [address]: {
                    ...pendingTransactions[address],
                    [platformId]: transactions,
                },
            },
        });
    }

    addPendingTransaction(platformId: number, transaction: PendingTransaction) {
        const { pendingTransactions } = this.store.getState();
        const address = transaction.sender.toLowerCase();
        this.store.updateState({
            pendingTransactions: {
                ...pendingTransactions,
                [address]: {
                    ...pendingTransactions[address],
                    [platformId]: [
                        transaction,
                        ...(pendingTransactions[address]?.[platformId] ?? []),
                    ],
                },
            },
        });
    }

    async updatePendingTransactionStatus(platformId: number, transaction: PendingTransaction) {
        const key = `${platformId}:${transaction.txHash ?? transaction.id}`;
        const existingTask = this.#pendingTxStatusTasks.get(key);

        if (existingTask) {
            return existingTask;
        }

        let status: TxtStatus = 'sending';
        let maxRetries = 60;

        const task = (async () => {
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            const provider = this.#getProviderByPlatformId(platformId);

            while (maxRetries > 0) {
                try {
                    const receipt = await provider.getTransactionReceipt(transaction.txHash);

                    if (receipt) {
                        if (receipt.status === 1) {
                            status = 'sent';
                        } else {
                            status = 'failed';
                        }

                        break;
                    }

                    maxRetries--;
                } catch (error) {
                    logger.log('updatePendingTransactionStatus error', error);
                    // Do NOT stop — likely RPC issue
                }

                logger.log('updatePendingTransactionStatus retry', maxRetries);
                await sleep(1000); // delay to reduce rate limit
            }

            this.#updateTxStatus(transaction, platformId, status);
            return status;
        })();

        this.#pendingTxStatusTasks.set(key, task);
        task.finally(() => {
            this.#pendingTxStatusTasks.delete(key);
        });

        return task;
    }

    async updatePendingTransaction(platformId: number, transaction: PendingTransaction) {
        const { pendingTransactions } = this.store.getState();
        const address = transaction.sender.toLowerCase();
        this.store.updateState({
            pendingTransactions: {
                ...pendingTransactions,
                [address]: {
                    ...pendingTransactions[address],
                    [platformId]: pendingTransactions[address]?.[platformId]?.map(item =>
                        item.id === transaction.id ? transaction : item,
                    ),
                },
            },
        });
    }

    removePendingTransactions(address: string, platformId: number, ids: string[]) {
        const { pendingTransactions } = this.store.getState();

        this.store.updateState({
            pendingTransactions: {
                ...pendingTransactions,
                [address]: {
                    ...pendingTransactions[address],
                    [platformId]: pendingTransactions[address]?.[platformId]?.filter(
                        item => !ids.includes(item.id),
                    ),
                },
            },
        });
    }

    removeCompletedTransactions(address: string, platformId: number) {
        const { pendingTransactions } = this.store.getState();
        this.store.updateState({
            pendingTransactions: {
                ...pendingTransactions,
                [address]: {
                    ...pendingTransactions[address],
                    [platformId]: pendingTransactions[address]?.[platformId]?.filter(
                        item => item.status !== 'sent' && item.status !== 'failed',
                    ),
                },
            },
        });
    }

    #updateTxStatus(tx: PendingTransaction, platformId: number, status: TxtStatus) {
        const { pendingTransactions } = this.store.getState();
        const address = tx.sender.toLowerCase();
        const updatedTx = { ...tx, status };
        this.store.updateState({
            pendingTransactions: {
                ...pendingTransactions,
                [address]: {
                    ...pendingTransactions[address],
                    [platformId]: pendingTransactions[address]?.[platformId]?.map(item =>
                        item.id === tx.id ? updatedTx : item,
                    ),
                },
            },
        });
    }

    /**
     * Registers message handlers for the PortfolioController.
     * @private
     */
    #registerMessageHandlers() {
        this.messagingSystem.registerActionHandler(
            `${controllerName}:getPortfolioCoins`,
            this.getPortfolioCoins.bind(this),
        );
    }
}
