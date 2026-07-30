import { Redirect } from 'react-router-dom';
import { SEND_ASSET_SELECT_ASSET_ROUTE } from '../../../shared/constants/routes';

export default function SendAssetFlowSwitch() {
    return <Redirect to={{ pathname: SEND_ASSET_SELECT_ASSET_ROUTE }} />;
}
