import { BigNumber } from '@ethersproject/bignumber';
import React from 'react';
import { TransactionType } from '../../../../../src/shared/types/Transaction';
import { DappInteractionContext } from '../../../../../src/ui/pages/DappInteraction/DappInteractionProvider';

const noopAsync = async () => {};

export const defaultDappInteractionContextValue = {
    subjectMetadata: {
        name: 'Example Dapp',
        origin: 'https://example.com',
        iconUrl: '',
    } as any,
    tokenAddress: '0x1111111111111111111111111111111111111111',
    origin: 'https://example.com',
    assetDetails: {
        tokenAmount: BigNumber.from(2),
        toAddress: '0x2222222222222222222222222222222222222222',
        balance: '10',
    },
    currentRequest: {
        id: 'tx1',
        type: TransactionType.contractInteraction,
        origin: 'https://example.com',
        txParams: {
            from: '0x3333333333333333333333333333333333333333',
            to: '0x4444444444444444444444444444444444444444',
            data: '0xdeadbeef',
            value: '0x0',
        },
    } as any,
    approvalAmount: '100',
    isSmartWallet: false,
    walletAddress: '0x3333333333333333333333333333333333333333',
    gasLimit: 21000,
    loadingGasLimit: false,
    initGasInfo: { gasPrice: 1n },
    setApprovalAmount: jest.fn(),
    onRejectPress: jest.fn(noopAsync),
    onConfirmPress: jest.fn(noopAsync),
    waitingRef: { current: false } as React.MutableRefObject<boolean | 'ignore'>,
    error: '',
    onGasChange: jest.fn(),
    emoji: null,
    confirmButtonDisabled: false,
    accountName: 'Account One',
    toAddress: '0x4444444444444444444444444444444444444444',
    currentAccount: undefined,
    gaslessCalls: [{ to: '0x4444444444444444444444444444444444444444', data: '0x', value: '0' }],
    isGaslessDisableRequired: false,
};

export type DappContextOverrides = Partial<typeof defaultDappInteractionContextValue>;

export function mergeDappContext(overrides: DappContextOverrides = {}) {
    return { ...defaultDappInteractionContextValue, ...overrides };
}

export function DappInteractionContextProviderHarness({
    children,
    value = defaultDappInteractionContextValue,
}: {
    children: React.ReactNode;
    value?: ReturnType<typeof mergeDappContext>;
}) {
    return (
        <DappInteractionContext.Provider value={value as any}>
            {children}
        </DappInteractionContext.Provider>
    );
}
