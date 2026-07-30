import { Redirect } from 'react-router-dom';
import { EARN_LIST_ROUTE } from '../../../shared/constants/routes';

export default function EarnSwitch() {
    return <Redirect to={{ pathname: EARN_LIST_ROUTE }} />;
}
