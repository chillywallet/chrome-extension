import { BaseController, RestrictedControllerMessenger } from '@metamask/base-controller';
import { Contract, ethers, JsonRpcProvider, TransactionResponse, Wallet } from 'ethers';
import { LiquidStakingProviders } from '../lib/liquid-staking';
import { LiquidStakingData } from '../lib/liquid-staking/Types';
import { getGasData, getTransactionErrorMessage, retryFunc } from '../lib/WalletUtils';
import { estimateGasWithPadding } from '../lib/web3';
import { EarnType } from '../shared/types/Earn';
import { GasInfo } from '../shared/types/Wallet';
import logger from '../shared/utils/logger';
import { NetworkControllerGetCurrentProviderAction } from './NetworkController';

const controllerName = 'LiquidStakingController';

export type LiquidStakingControllerState = {};

const defaultState: LiquidStakingControllerState = {};

export type LiquidStakingControllerSetLiquidStakingProvider = {
    type: `${typeof controllerName}:setLiquidStakingProvider`;
    handler: LiquidStakingController['setLiquidStakingProvider'];
};

export type LiquidStakingControllerActions = LiquidStakingControllerSetLiquidStakingProvider;

export type LiquidStakingControllerMessenger = RestrictedControllerMessenger<
    typeof controllerName,
    LiquidStakingControllerActions | NetworkControllerGetCurrentProviderAction,
    never,
    NetworkControllerGetCurrentProviderAction['type'],
    never
>;

type Props = {
    state: LiquidStakingControllerState;
    messenger: LiquidStakingControllerMessenger;
    getPrivateKey: (address: string) => Promise<string>;
    getProviderByChainId: (chainId: number) => JsonRpcProvider;
};
export default class LiquidStakingController extends BaseController<
    typeof controllerName,
    LiquidStakingControllerState,
    LiquidStakingControllerMessenger
> {
    liquidStakingProvider?: LiquidStakingData;

    contract?: Contract;

    #getPrivateKey: (address: string) => Promise<string>;
    #getProviderByChainId: (chainId: number) => JsonRpcProvider;

    constructor(opts: Props) {
        super({
            name: controllerName,
            metadata: {
                rpcTransactions: {
                    persist: true,
                    anonymous: false,
                },
            },
            messenger: opts.messenger,
            state: {
                ...defaultState,
                ...opts.state,
            },
        });

        this.#getPrivateKey = opts.getPrivateKey;
        this.#getProviderByChainId = opts.getProviderByChainId;

        this.#registerMessageHandlers();
    }

    setLiquidStakingProvider(type: EarnType) {
        this.liquidStakingProvider = LiquidStakingProviders[type];
        if (!this.liquidStakingProvider) {
            throw new Error('Liquid staking provider not found.');
        }
        this.contract = new Contract(
            this.liquidStakingProvider.contractAddress,
            this.liquidStakingProvider.abi,
            this.#getCurrentProvider(),
        );
        return this.liquidStakingProvider;
    }

    getLiquidStakingProvider() {
        return this.liquidStakingProvider;
    }

    async getExchangeRate(amount: string): Promise<number> {
        if (!this.contract) {
            throw new Error('Contract not initialized.');
        }

        return await retryFunc(
            async () => {
                const result = await this.contract![
                    this.liquidStakingProvider!.fetchExchangeRateMethod
                ](ethers.parseEther(amount));
                const rateStr = ethers.formatEther(result);
                return parseFloat(rateStr);
            },
            { delay: 1000, count: 3 },
        );
    }

    async getUnstakeExchangeRate(amount: string): Promise<number> {
        if (!this.contract) {
            throw new Error('Contract not initialized.');
        }

        return await retryFunc(
            async () => {
                const result = await this.contract![
                    this.liquidStakingProvider!.fetchUnstakeExchangeRateMethod
                ](ethers.parseEther(amount));
                const rateStr = ethers.formatEther(result);
                return parseFloat(rateStr);
            },
            { delay: 1000, count: 3 },
        );
    }

    async getWaitTime(): Promise<number> {
        if (!this.contract) {
            throw new Error('Contract not initialized.');
        }

        if (
            !this.liquidStakingProvider!.waitTimeMethod &&
            !this.liquidStakingProvider!.getWaitTime
        ) {
            throw new Error('waitTimeMethod not exists.');
        }

        if (this.liquidStakingProvider!.getWaitTime) {
            return this.liquidStakingProvider!.getWaitTime();
        } else if (this.liquidStakingProvider!.waitTimeMethod) {
            const waitTimeMethodName = this.liquidStakingProvider!.waitTimeMethod;
            const waitTime = await retryFunc(
                async () => {
                    const waitTimeFunc = this.contract!.getFunction(waitTimeMethodName);
                    return (await waitTimeFunc()) as bigint;
                },
                { delay: 1000, count: 3 },
            );

            return Number(waitTime);
        }

        return 0;
    }

    async getClaimRequests(walletAddress: string) {
        if (!this.liquidStakingProvider) {
            throw new Error('Provider not initialized.');
        }

        if (!this.liquidStakingProvider.getClaimRequests) {
            throw new Error('getClaimRequests not exists.');
        }

        if (!this.contract) {
            throw new Error('Contract not initialized.');
        }

        return await this.liquidStakingProvider!.getClaimRequests(
            walletAddress,
            this.contract,
            this.#getCurrentProvider(),
        );
    }

    estimateStake(walletAddress: string, amount: string) {
        if (!this.contract) {
            throw new Error('Contract not initialized.');
        }

        const stakeCall = this.getStakeCall(amount, walletAddress);

        const transactionRequest = {
            from: walletAddress,
            ...stakeCall,
        };

        return estimateGasWithPadding(transactionRequest, null, null, this.#getCurrentProvider());
    }

    estimateRequestUnstake(walletAddress: string, amount: string) {
        if (!this.contract) {
            throw new Error('Contract not initialized.');
        }

        const requestUnstakeCall = this.getRequestUnstakeCall(amount, walletAddress);

        const transactionRequest = {
            from: walletAddress,
            ...requestUnstakeCall,
        };

        return estimateGasWithPadding(transactionRequest, null, null, this.#getCurrentProvider());
    }

    estimateUnstake(walletAddress: string, requestIDs?: number[] | string, amount?: string) {
        if (!this.contract) {
            throw new Error('Contract not initialized.');
        }

        const unstakeCall = this.getUnstakeCall(amount || '0', walletAddress, requestIDs);

        const transactionRequest = {
            from: walletAddress,
            ...unstakeCall,
        };

        return estimateGasWithPadding(transactionRequest, null, null, this.#getCurrentProvider());
    }

    estimateCancelUnstakeRequest(requestId: string, walletAddress: string) {
        if (!this.contract) {
            throw new Error('Contract not initialized.');
        }

        const cancelUnstakeRequestCall = this.getCancelUnstakeRequestCall(requestId, walletAddress);

        const transactionRequest = {
            from: walletAddress,
            ...cancelUnstakeRequestCall,
        };

        return estimateGasWithPadding(transactionRequest, null, null, this.#getCurrentProvider());
    }

    /**
     * Get stake call data for batched confirmations
     */
    getStakeCall(amount: string, walletAddress: string) {
        if (!this.contract || !this.liquidStakingProvider) {
            throw new Error('Liquid staking provider not set');
        }

        const stakeMethodName = this.liquidStakingProvider.stakeMethod;
        const args = this.liquidStakingProvider.getStakeArgs(BigInt(amount), walletAddress);
        const data = this.contract.interface.encodeFunctionData(stakeMethodName, args);

        return {
            to: this.liquidStakingProvider.contractAddress,
            data,
            value: amount,
        };
    }

    /**
     * Get request unstake call data for batched confirmations
     */
    getRequestUnstakeCall(amount: string, walletAddress: string) {
        if (!this.contract || !this.liquidStakingProvider) {
            throw new Error('Liquid staking provider not set');
        }

        if (!this.liquidStakingProvider.requestUnstakeMethod) {
            throw new Error('requestUnstakeMethod not exists.');
        }

        if (!this.liquidStakingProvider.getRequestUnstakeArgs) {
            throw new Error('getRequestUnstakeArgs not exists.');
        }

        const requestUnstakeMethodName = this.liquidStakingProvider.requestUnstakeMethod;
        const args = this.liquidStakingProvider.getRequestUnstakeArgs(
            BigInt(amount),
            walletAddress,
        );

        const data = this.contract.interface.encodeFunctionData(requestUnstakeMethodName, args);

        return {
            to: this.liquidStakingProvider.contractAddress,
            data,
            value: '0',
        };
    }

    /**
     * Get unstake call data for batched confirmations
     */
    getUnstakeCall(amount: string, walletAddress: string, requestIDs?: number[] | string) {
        if (!this.contract || !this.liquidStakingProvider) {
            throw new Error('Liquid staking provider not set');
        }

        const unstakeMethodName = this.liquidStakingProvider.unstakeMethod;
        const args = this.liquidStakingProvider.getUnstakeArgs(
            walletAddress,
            requestIDs,
            amount ? BigInt(amount) : undefined,
        );

        const data = this.contract.interface.encodeFunctionData(unstakeMethodName, args);

        return {
            to: this.liquidStakingProvider.contractAddress,
            data,
            value: '0',
        };
    }

    /**
     * Get cancel unstake request call data for batched confirmations
     */
    getCancelUnstakeRequestCall(requestId: string, _walletAddress: string) {
        if (!this.contract || !this.liquidStakingProvider) {
            throw new Error('Liquid staking provider not set');
        }

        const cancelUnstakeRequestMethod = this.liquidStakingProvider.cancelUnstakeRequestMethod!;
        const data = this.contract.interface.encodeFunctionData(cancelUnstakeRequestMethod, [
            requestId,
        ]);

        return {
            to: this.liquidStakingProvider.contractAddress,
            data,
            value: '0',
        };
    }

    async stake(
        walletAddress: string,
        amount: string,
        gasInfo: GasInfo,
        gasLimit: number,
    ): Promise<TransactionResponse | null> {
        if (!this.contract) {
            return null;
        }

        try {
            const wallet = await this.#loadWallet(walletAddress, this.#getCurrentProvider());

            const contractWithSigner = this.contract!.connect(wallet);
            const stakeMethodName = this.liquidStakingProvider!.stakeMethod;
            const args = this.liquidStakingProvider!.getStakeArgs(BigInt(amount), walletAddress);

            const overrides: any = {
                from: walletAddress,
                value: amount,
                gasLimit: gasLimit,
                ...getGasData(gasInfo),
            };

            return await retryFunc(async () => {
                const func = contractWithSigner.getFunction(stakeMethodName);
                return await func(...args, overrides);
            });
        } catch (error: any) {
            logger.error('🔴 stake', error);
            const message = getTransactionErrorMessage(error);
            throw new Error(message);
        }
    }

    async requestUnstake(
        walletAddress: string,
        amount: string,
        gasInfo: GasInfo,
        gasLimit: number,
    ): Promise<TransactionResponse | null> {
        if (!this.contract) {
            return null;
        }

        if (!this.liquidStakingProvider!.requestUnstakeMethod) {
            throw new Error('requestUnstakeMethod not exists.');
        }

        if (!this.liquidStakingProvider!.getRequestUnstakeArgs) {
            throw new Error('getRequestUnstakeArgs not exists.');
        }

        try {
            const wallet = await this.#loadWallet(walletAddress, this.#getCurrentProvider());

            const contractWithSigner = this.contract!.connect(wallet);
            const requestUnstakeMethodName = this.liquidStakingProvider!.requestUnstakeMethod;
            const args = this.liquidStakingProvider!.getRequestUnstakeArgs(
                BigInt(amount),
                walletAddress,
            );

            const overrides: any = {
                from: walletAddress,
                gasLimit: gasLimit,
                ...getGasData(gasInfo),
            };

            return await retryFunc(async () => {
                const func = contractWithSigner.getFunction(requestUnstakeMethodName);
                return await func(...args, overrides);
            });
        } catch (error: any) {
            logger.error('🔴 requestUnstake', error);
            const message = getTransactionErrorMessage(error);
            throw new Error(message);
        }
    }

    async unstake(
        walletAddress: string,
        requestIDs: number[] | string | undefined,
        amount: string | undefined,
        gasInfo: GasInfo,
        gasLimit: number,
    ): Promise<TransactionResponse | null> {
        if (!this.contract) {
            return null;
        }

        try {
            const wallet = await this.#loadWallet(walletAddress, this.#getCurrentProvider());

            const contractWithSigner = this.contract!.connect(wallet);
            const unstakeMethodName = this.liquidStakingProvider!.unstakeMethod;
            const args = this.liquidStakingProvider!.getUnstakeArgs(
                walletAddress,
                requestIDs,
                amount ? BigInt(amount) : undefined,
            );

            const overrides: any = {
                from: walletAddress,
                gasLimit: gasLimit,
                ...getGasData(gasInfo),
            };

            return await retryFunc(async () => {
                const func = contractWithSigner.getFunction(unstakeMethodName);
                return await func(...args, overrides);
            });
        } catch (error: any) {
            logger.error('🔴 unstake', error);
            const message = getTransactionErrorMessage(error);
            throw new Error(message);
        }
    }

    async cancelUnstakeRequest(
        requestId: string,
        walletAddress: string,
        gasInfo: GasInfo,
        gasLimit: number,
    ): Promise<TransactionResponse | null> {
        if (!this.contract) {
            return null;
        }

        try {
            const wallet = await this.#loadWallet(walletAddress, this.#getCurrentProvider());

            const contractWithSigner = this.contract!.connect(wallet);
            const cancelUnstakeRequestMethod =
                this.liquidStakingProvider!.cancelUnstakeRequestMethod!;

            const overrides: any = {
                from: walletAddress,
                gasLimit: gasLimit,
                ...getGasData(gasInfo),
            };

            const func = contractWithSigner.getFunction(cancelUnstakeRequestMethod);
            return await retryFunc(async () => {
                return await func(requestId, overrides);
            });
        } catch (error: any) {
            logger.error('🔴 cancelUnstakeRequest', error);
            const message = getTransactionErrorMessage(error);
            throw new Error(message);
        }
    }

    /**
     * Registers message handlers for the AccountsController.
     * @private
     */
    #registerMessageHandlers() {}

    #getCurrentProvider(): JsonRpcProvider {
        return this.messagingSystem.call('NetworkController:getCurrentProvider');
    }

    async #loadWallet(walletAddress: string, provider: JsonRpcProvider) {
        const privateKey = await this.#getPrivateKey(walletAddress);
        return new Wallet(privateKey, provider);
    }
}
