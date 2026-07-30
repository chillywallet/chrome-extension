import { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import {
    ONBOARDING_CONNECT_HARDWARE_WALLET_ROUTE,
    ONBOARDING_CREATE_WALLET_ROUTE,
    ONBOARDING_IMPORT_WALLET_SELECT_TYPE_ROUTE,
} from '../../shared/constants/routes';
import WelcomeWalletChoiceLayout from '../components/WelcomeWalletChoiceLayout';

export default function OnboardingWelcome() {
    const history = useHistory();

    const createWallet = useCallback(() => {
        history.push(ONBOARDING_CREATE_WALLET_ROUTE);
    }, [history]);

    const importWallet = useCallback(() => {
        history.push(ONBOARDING_IMPORT_WALLET_SELECT_TYPE_ROUTE);
    }, [history]);

    const connectHardwareWallet = useCallback(() => {
        history.push(ONBOARDING_CONNECT_HARDWARE_WALLET_ROUTE);
    }, [history]);

    return (
        <WelcomeWalletChoiceLayout
            title="Let's get started"
            subtitleLine1="Chilly isn't just a regular wallet."
            subtitleLine2="We provide the tools that help you stay informed and degen on the go"
            onCreateWallet={createWallet}
            onImportWallet={importWallet}
            onConnectHardwareWallet={connectHardwareWallet}
        />
    );
}
