import { Redirect } from 'react-router-dom';
import { FORGOT_CODE_RECOVER_CODE_ROUTE } from '../../shared/constants/routes';

export default function ForgotCodeFlowSwitch() {
    return <Redirect to={{ pathname: FORGOT_CODE_RECOVER_CODE_ROUTE }} />;
}
