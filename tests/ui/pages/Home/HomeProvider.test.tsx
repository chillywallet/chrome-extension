import React, { useEffect } from 'react';
import { render, screen } from '@testing-library/react';

import HomeProvider, { useHomeData } from '../../../../src/ui/pages/Home/HomeProvider';

describe('HomeProvider', () => {
    function Consumer() {
        const ctx = useHomeData();
        useEffect(() => {
            expect(ctx).toBeDefined();
        }, [ctx]);
        return <span data-testid="home-ctx">{Object.keys(ctx).length}</span>;
    }

    it('provides empty context', () => {
        render(
            <HomeProvider>
                <Consumer />
            </HomeProvider>,
        );
        expect(screen.getByTestId('home-ctx')).toHaveTextContent('0');
    });
});
