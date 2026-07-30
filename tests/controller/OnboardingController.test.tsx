import OnboardingController from '../../src/controller/OnboardingController';

describe('OnboardingController', () => {
    it('initializes with completedOnboarding=false and step=none', () => {
        const c = new OnboardingController({ state: {} as any });
        expect(c.store.getState().completedOnboarding).toBe(false);
        expect(c.store.getState().onboardingStep).toBe('none');
    });

    it('honors options state overriding defaults', () => {
        const c = new OnboardingController({
            state: { completedOnboarding: true, onboardingStep: 'create_wallet' } as any,
        });
        expect(c.store.getState().completedOnboarding).toBe(true);
    });

    it('completeOnboarding sets the flag to true', () => {
        const c = new OnboardingController({ state: {} as any });
        c.completeOnboarding();
        expect(c.store.getState().completedOnboarding).toBe(true);
    });

    it('setOnboardingStep returns true and updates state', () => {
        const c = new OnboardingController({ state: {} as any });
        const result = c.setOnboardingStep('create_wallet' as any);
        expect(result).toBe(true);
        expect(c.store.getState().onboardingStep).toBe('create_wallet');
    });
});
