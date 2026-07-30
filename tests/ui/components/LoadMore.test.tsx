import React from 'react';
import { render, screen } from '@testing-library/react';
import LoadMore from '../../../src/ui/components/LoadMore';

describe('LoadMore', () => {
    it('renders "Loading More" text', () => {
        render(<LoadMore />);
        expect(screen.getByText('Loading More')).toBeInTheDocument();
    });
});
