import { Sounds } from '../../../src/shared/utils/Sounds';

describe('Sounds', () => {
    it('exposes karma and kidsCheering keys', () => {
        expect(Sounds).toHaveProperty('karma');
        expect(Sounds).toHaveProperty('kidsCheering');
    });
});
