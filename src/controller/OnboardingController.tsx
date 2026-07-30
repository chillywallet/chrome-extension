import { ObservableStore } from '@metamask/obs-store';
import { OnboardingStep } from '../shared/types/Onboarding';

export type OnboardingControllerState = {
    completedOnboarding: boolean;
    onboardingStep: OnboardingStep;
};

const defaultState: OnboardingControllerState = {
    completedOnboarding: false,
    onboardingStep: 'none',
};

type Props = {
    state: OnboardingControllerState;
};

export default class OnboardingController {
    store: ObservableStore<OnboardingControllerState>;

    constructor(opts: Props) {
        const initState = {
            ...defaultState,
            ...opts.state,
        };

        this.store = new ObservableStore(initState);
    }

    completeOnboarding() {
        this.store.updateState({
            completedOnboarding: true,
        });
    }

    setOnboardingStep(onboardingStep: OnboardingStep) {
        this.store.updateState({
            onboardingStep,
        });
        return true;
    }
}
