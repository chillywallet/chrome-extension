import { Redirect } from 'react-router-dom';
import {
    DEFAULT_ROUTE,
    LOCK_ROUTE,
    ONBOARDING_HOME_ROUTE,
    ONBOARDING_UNLOCK_ROUTE,
} from '../../shared/constants/routes';
import { useCompletedOnboarding, useIsInitialized, useIsUnlocked } from '../../store/selectors';

export default function OnboardingFlowSwitch() {
    const isInitialized = useIsInitialized();
    const completedOnboarding = useCompletedOnboarding();
    const isUnlocked = useIsUnlocked();

    if (completedOnboarding) {
        return <Redirect to={{ pathname: DEFAULT_ROUTE }} />;
    }

    if (isUnlocked) {
        return <Redirect to={{ pathname: LOCK_ROUTE }} />;
    }

    if (!isInitialized) {
        return <Redirect to={{ pathname: ONBOARDING_HOME_ROUTE }} />;
    }

    return <Redirect to={{ pathname: ONBOARDING_UNLOCK_ROUTE }} />;
}
