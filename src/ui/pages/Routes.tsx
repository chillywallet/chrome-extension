import { useCallback } from 'react';
import { Switch, useHistory, withRouter } from 'react-router-dom';
import { Route } from 'react-router-dom';

import {
    ADD_NEW_WALLET_ROUTE,
    ASSET_COIN_DETAIL_ROUTE,
    ASSET_NFT_COLLECTION_ROUTE,
    ASSET_NFT_DETAIL_ROUTE,
    ASSET_ROUTE,
    COIN_DETAIL_ROUTE,
    CONTACT_ROUTE,
    DEFAULT_ROUTE,
    DEVELOP_ROUTE,
    EARN_ROUTE,
    FORGOT_CODE_RECOVER_CODE_ROUTE,
    FORGOT_CODE_ROUTE,
    GAS_OPTIONS_ROUTE,
    ICON_SELECTOR_ROUTE,
    LOCK_ROUTE,
    ONBOARDING_HOME_ROUTE,
    ONBOARDING_ROUTE,
    SEARCH_LIST_ROUTE,
    SEND_ASSET_ROUTE,
    SETTINGS_ROUTE,
    SWAP_ROUTE,
    TX_CONFIRMATION_ROUTE,
    UNLOCK_ROUTE,
} from '../../shared/constants/routes';

import Asset from './Asset';
import Authenticated from './Authenticated';
import CoinDetail from './CoinDetail';
import Contact from './Contact';
import Develop from './Develop';
import ForgotCodeFlow from './ForgotCodeFlow';
import Home from './Home/Home';
import IconSelector from './IconSelector';
import Lock from './Lock';
import NFTDetail from './NFTDetail';
import OnboardingFlow from './OnboardingFlow';
import OnboardingHome from './OnboardingHome';
import Unlock from './Unlock';

import SendAssetFlow from './Send/SendAssetFlow';

import { ENVIRONMENT_TYPE_FULLSCREEN } from '../../shared/constants/app';
import { getEnvironmentType } from '../../shared/utils/utils';
import AddNewWalletFlow from './AddNewWalletFlow';
import AssetCoinDetail from './AssetCoinDetail';
import TransactionConfirmationFlow from './DappInteraction/TransactionConfirmationFlow';
import EarnFlow from './Earn/EarnFlow';
import EarnProvider from './Earn/EarnProvider';
import GasOptions from './GasOptions';
import NFTCollection from './NFTCollection';
import RoutesProvider from './RoutesProvider';
import SearchList from './SearchList';
import Settings from './Settings';
import Swap from './Swap';

function Routes() {
    const history = useHistory();

    const onUnlockSuccess = useCallback(async () => {
        history.replace(DEFAULT_ROUTE);
    }, [history]);

    const onForgotPinCode = useCallback(() => {
        if (getEnvironmentType() === ENVIRONMENT_TYPE_FULLSCREEN) {
            history.push(FORGOT_CODE_RECOVER_CODE_ROUTE);
        } else {
            global.platform.openExtensionInBrowser(FORGOT_CODE_RECOVER_CODE_ROUTE);
        }
    }, [history]);

    return (
        <RoutesProvider>
            <EarnProvider>
                <Switch>
                    <Route path={ONBOARDING_ROUTE} component={OnboardingFlow} />
                    <Route path={ADD_NEW_WALLET_ROUTE} component={AddNewWalletFlow} />
                    <Route path={FORGOT_CODE_ROUTE} component={ForgotCodeFlow} />
                    <Authenticated path={DEFAULT_ROUTE} component={Home} exact />
                    <Authenticated path={ASSET_ROUTE} component={Asset} exact />
                    <Authenticated path={CONTACT_ROUTE} component={Contact} exact />
                    <Authenticated path={GAS_OPTIONS_ROUTE} component={GasOptions} exact />
                    <Authenticated path={ICON_SELECTOR_ROUTE} component={IconSelector} exact />
                    <Authenticated path={SEND_ASSET_ROUTE} component={SendAssetFlow} />
                    <Authenticated
                        path={TX_CONFIRMATION_ROUTE}
                        component={TransactionConfirmationFlow}
                    />
                    <Authenticated path={COIN_DETAIL_ROUTE} component={CoinDetail} />
                    <Authenticated path={ASSET_NFT_COLLECTION_ROUTE} component={NFTCollection} />
                    <Authenticated path={ASSET_NFT_DETAIL_ROUTE} component={NFTDetail} />
                    <Authenticated path={ASSET_COIN_DETAIL_ROUTE} component={AssetCoinDetail} />
                    <Authenticated path={SWAP_ROUTE} component={Swap} />
                    <Authenticated path={SEARCH_LIST_ROUTE} component={SearchList} />
                    <Authenticated path={SETTINGS_ROUTE} component={Settings} exact />
                    <Authenticated path={EARN_ROUTE} component={EarnFlow} />

                    {process.env.BUILD_TYPE !== 'Prod' && (
                        <Authenticated path={DEVELOP_ROUTE} component={Develop} exact />
                    )}

                    <Route path={ONBOARDING_HOME_ROUTE} component={OnboardingHome} exact />
                    <Route path={LOCK_ROUTE} component={Lock} exact />
                    <Route
                        path={UNLOCK_ROUTE}
                        component={(props: any) => (
                            <Unlock
                                {...props}
                                onUnlockSuccess={onUnlockSuccess}
                                onForgotPinCode={onForgotPinCode}
                            />
                        )}
                        exact
                    />
                </Switch>
            </EarnProvider>
        </RoutesProvider>
    );
}

export default withRouter(Routes);
