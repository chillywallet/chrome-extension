import { render } from '@testing-library/react';

import { Placeholder } from '../../../../src/ui/pages/Home/Explore/ExploreTabCoins';

describe('ExploreTabCoins Placeholder', () => {
    it('renders skeleton rows', () => {
        const { container } = render(<Placeholder />);
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });
});
