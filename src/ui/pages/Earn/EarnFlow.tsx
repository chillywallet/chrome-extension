import React from 'react';
import { Switch } from 'react-router-dom';
import {
    EARN_LIQUID_STAKING_CLAIM_ROUTE,
    EARN_LIQUID_STAKING_ROUTE,
    EARN_LIST_ROUTE,
} from '../../../shared/constants/routes';
import { Route } from 'react-router-dom';
import EarnList from './EarnList';
import EarnSwitch from './EarnSwitch';
import LiquidStaking from './LiquidStaking';
import LiquidStakingClaim from './LiquidStakingClaim';

export default React.memo(() => {
    return (
        <Switch>
            <Route path={EARN_LIST_ROUTE} component={EarnList} />
            <Route path={EARN_LIQUID_STAKING_ROUTE} component={LiquidStaking} />
            <Route path={EARN_LIQUID_STAKING_CLAIM_ROUTE} component={LiquidStakingClaim} />

            <Route exact path="*" component={EarnSwitch} />
        </Switch>
    );
});
