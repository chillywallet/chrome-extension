import { useSelector } from 'react-redux';
import { ReduxState } from '../store';

export const useCurrentPlatformId = () => {
    const network = useSelector((state: ReduxState) => state.globalState.selectedNetwork);
    return network.platform_id;
};
