import React, { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import {
    ADD_NEW_WALLET_CONNECT_HARDWARE_WALLET_ROUTE,
    ADD_NEW_WALLET_CREATE_WALLET_ROUTE,
    ADD_NEW_WALLET_IMPORT_WALLET_SELECT_TYPE_ROUTE,
} from '../../shared/constants/routes';
import WelcomeWalletChoiceLayout from '../components/WelcomeWalletChoiceLayout';

export default function AddNewWallet() {
    const history = useHistory();

    const createWallet = useCallback(() => {
        history.push(ADD_NEW_WALLET_CREATE_WALLET_ROUTE);
    }, [history]);

    const importWallet = useCallback(() => {
        history.push(ADD_NEW_WALLET_IMPORT_WALLET_SELECT_TYPE_ROUTE);
    }, [history]);

    const connectHardwareWallet = useCallback(() => {
        history.push(ADD_NEW_WALLET_CONNECT_HARDWARE_WALLET_ROUTE);
    }, [history]);

    return (
        <WelcomeWalletChoiceLayout
            title="Add New Wallet"
            subtitleLine1="Welcome to your wallet setup."
            subtitleLine2="Build a new wallet for your assets or connect an existing one seamlessly."
            onCreateWallet={createWallet}
            onImportWallet={importWallet}
            onConnectHardwareWallet={connectHardwareWallet}
        />
    );
}
