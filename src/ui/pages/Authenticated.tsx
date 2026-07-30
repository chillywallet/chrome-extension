import React from 'react';
import { Redirect } from 'react-router-dom';
import { ONBOARDING_ROUTE, UNLOCK_ROUTE } from '../../shared/constants/routes';
import { useCompletedOnboarding, useIsUnlocked } from '../../store/selectors';
import { Route } from 'react-router-dom';

type Props = {
    path: string;
    exact?: boolean;
    component?: any;
    render?: any;
};

export default React.memo<Props>((props: Props) => {
    const {} = props;
    const isUnlocked = useIsUnlocked();
    const completedOnboarding = useCompletedOnboarding();

    if (isUnlocked && completedOnboarding) {
        return <Route {...props} />;
    } else if (!completedOnboarding) {
        return <Redirect to={{ pathname: ONBOARDING_ROUTE }} />;
    } else {
        return <Redirect to={{ pathname: UNLOCK_ROUTE }} />;
    }
});
