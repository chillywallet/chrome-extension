import { Redirect } from 'react-router-dom';
import {
    ADD_NEW_WALLET_HOME_ROUTE,
    ADD_NEW_WALLET_UNLOCK_ROUTE,
} from '../../shared/constants/routes';
import { useIsUnlocked } from '../../store/selectors';

export default function AddNewWalletFlowSwitch() {
    const isUnlocked = useIsUnlocked();

    if (isUnlocked) {
        return <Redirect to={{ pathname: ADD_NEW_WALLET_HOME_ROUTE }} />;
    }

    return <Redirect to={{ pathname: ADD_NEW_WALLET_UNLOCK_ROUTE }} />;
}
