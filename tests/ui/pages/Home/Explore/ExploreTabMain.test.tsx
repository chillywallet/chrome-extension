// Smoke test for ExploreTabMain module.

describe('ExploreTabMain module', () => {
    it('exports a default component', () => {
        const mod = require('../../../../../src/ui/pages/Home/Explore/ExploreTabMain');
        expect(mod.default).toBeDefined();
    });
});
