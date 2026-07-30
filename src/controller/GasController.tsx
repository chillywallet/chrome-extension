import { ActionConstraint, RestrictedControllerMessenger } from '@metamask/base-controller';
import { ObservableStore } from '@metamask/obs-store';
import { JsonRpcProvider, parseUnits } from 'ethers';
import _ from 'lodash';
import { deserializeBigInt, SerializeBigInt, serializeBigInt } from '../lib/bigintSerializer';
import { getCurrentChainByChainId } from '../lib/ChainsUtils';
import { ChainData, GasPriceType } from '../shared/types/Chain';
import type { GasPriceSetting } from '../shared/types/Global';
import { GasInfo, GasOptionsData, GasType } from '../shared/types/Wallet';
import logger from '../shared/utils/logger';
import { NetworkControllerNetworkChangeEvent } from './NetworkController';
const controllerName = 'GasController';

// Gas option multipliers for EIP-1559 networks
const EIP1559_GAS_MULTIPLIERS = {
    low: {
        priorityMultiplier: 70n,
        maxFeeMultiplier: 85n,
    },
    medium: {
        priorityMultiplier: 100n,
        maxFeeMultiplier: 100n,
    },
    high: {
        priorityMultiplier: 150n,
        maxFeeMultiplier: 130n,
    },
} as const;

// Gas option multipliers for legacy networks
const LEGACY_GAS_MULTIPLIERS = {
    low: 90n,
    medium: 100n,
    high: 110n,
} as const;

export type GasControllerState = {
    customGas: Record<number, SerializeBigInt<GasInfo>>;
    gasType: Record<number, GasType>;
    gasOptionsData: Record<number, SerializeBigInt<GasOptionsData>>;
};

const defaultState: GasControllerState = {
    customGas: {},
    gasType: {},
    gasOptionsData: {},
};
export type AllowedEvents = NetworkControllerNetworkChangeEvent;

export type GasControllerMessenger = RestrictedControllerMessenger<
    typeof controllerName,
    ActionConstraint,
    AllowedEvents,
    any,
    AllowedEvents['type']
>;

type Props = {
    state: GasControllerState;
    messenger: GasControllerMessenger;
    getProviderForNetwork: (network: ChainData) => JsonRpcProvider;
};

export default class GasController {
    store: ObservableStore<GasControllerState>;
    messagingSystem: GasControllerMessenger;
    #getProviderForNetwork: (network: ChainData) => JsonRpcProvider;

    constructor(opts: Props) {
        const initState = {
            ...defaultState,
            ...opts.state,
        };

        this.store = new ObservableStore(initState);
        this.messagingSystem = opts.messenger;
        this.#getProviderForNetwork = opts.getProviderForNetwork;

        this.#registerMessageHandlers();
    }

    setCustomGas(data: GasInfo, network: ChainData) {
        const serializedCustomGas = this.store.getState().customGas;
        const customGas = deserializeBigInt(serializedCustomGas);
        customGas[network.chain_id] = data;
        this.store.updateState({
            customGas: serializeBigInt(customGas),
        });
    }

    setGasType(data: GasType, network: ChainData) {
        const gasType = this.store.getState().gasType;
        const temp = _.cloneDeep(gasType);
        temp[network.chain_id] = data;
        this.store.updateState({
            gasType: temp,
        });
    }

    setGasOptionsData(data: GasOptionsData, network: ChainData) {
        const serializedGasOptionsData = this.store.getState().gasOptionsData;
        const gasOptionsData = deserializeBigInt(serializedGasOptionsData);
        gasOptionsData[network.chain_id] = data;
        this.store.updateState({
            gasOptionsData: serializeBigInt(gasOptionsData),
        });
    }

    async loadGasOptions(
        chainId: number,
        gasPriceConfig?: Pick<GasPriceSetting, 'customPriorityFee' | 'customGasPrice'>,
    ): Promise<GasOptionsData | undefined> {
        const network = getCurrentChainByChainId(chainId);
        const provider = this.#getProviderForNetwork(network);

        const feeData = await provider.getFeeData();
        const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = feeData;
        const customPriority = gasPriceConfig?.customPriorityFee;
        const customGasPrice = gasPriceConfig?.customGasPrice;

        // -------------------------------
        // EIP-1559 networks
        // -------------------------------
        if (
            network.gasPriceType === GasPriceType.BaseAndPriority &&
            maxFeePerGas != null
        ) {
            const lastPriorityFee =
                maxPriorityFeePerGas != null ? maxPriorityFeePerGas : 0n;

            let lowPriorityFee =
                (lastPriorityFee * EIP1559_GAS_MULTIPLIERS.low.priorityMultiplier) / 100n;
            const lowMaxFee =
                (maxFeePerGas * EIP1559_GAS_MULTIPLIERS.low.maxFeeMultiplier) / 100n;
            let lowBaseFee = lowMaxFee - lowPriorityFee;
            lowPriorityFee = customPriority?.low
                ? parseUnits(customPriority.low, 'gwei')
                : lowPriorityFee;

            let mediumPriorityFee =
                (lastPriorityFee * EIP1559_GAS_MULTIPLIERS.medium.priorityMultiplier) / 100n;
            const mediumMaxFee =
                (maxFeePerGas * EIP1559_GAS_MULTIPLIERS.medium.maxFeeMultiplier) / 100n;
            let mediumBaseFee = mediumMaxFee - mediumPriorityFee;
            mediumPriorityFee = customPriority?.medium
                ? parseUnits(customPriority.medium, 'gwei')
                : mediumPriorityFee;

            let highPriorityFee =
                (lastPriorityFee * EIP1559_GAS_MULTIPLIERS.high.priorityMultiplier) / 100n;
            const highMaxFee =
                (maxFeePerGas * EIP1559_GAS_MULTIPLIERS.high.maxFeeMultiplier) / 100n;
            let highBaseFee = highMaxFee - highPriorityFee;
            highPriorityFee = customPriority?.high
                ? parseUnits(customPriority.high, 'gwei')
                : highPriorityFee;

            const currentBaseFee = (maxFeePerGas - lastPriorityFee) / 2n;

            const gasOptionsData: GasOptionsData = {
                low: {
                    priorityFee: lowPriorityFee,
                    baseFee: lowBaseFee,
                    maxFeePerGas: lowPriorityFee + lowBaseFee,
                },
                medium: {
                    priorityFee: mediumPriorityFee,
                    baseFee: mediumBaseFee,
                    maxFeePerGas: mediumPriorityFee + mediumBaseFee,
                },
                high: {
                    priorityFee: highPriorityFee,
                    baseFee: highBaseFee,
                    maxFeePerGas: highPriorityFee + highBaseFee,
                },
                currentBaseFee,
            };

            logger.log('⛽️ EIP-1559 Gas Options', network.chain_id, gasOptionsData);
            return gasOptionsData;
        }

        // -------------------------------
        // Legacy gas price networks
        // -------------------------------
        if (gasPrice != null) {
            const gasOptionsData: GasOptionsData = {
                low: {
                    gasPrice: customGasPrice?.low
                        ? parseUnits(customGasPrice.low, 'gwei')
                        : (gasPrice * LEGACY_GAS_MULTIPLIERS.low) / 100n,
                },
                medium: {
                    gasPrice: customGasPrice?.medium
                        ? parseUnits(customGasPrice.medium, 'gwei')
                        : (gasPrice * LEGACY_GAS_MULTIPLIERS.medium) / 100n,
                },
                high: {
                    gasPrice: customGasPrice?.high
                        ? parseUnits(customGasPrice.high, 'gwei')
                        : (gasPrice * LEGACY_GAS_MULTIPLIERS.high) / 100n,
                },
            };

            logger.log('⛽️ Legacy Gas Options', network.chain_id, gasOptionsData);
            return gasOptionsData;
        }
    }

    #registerMessageHandlers() {}
}
