import React from 'react';
import { render, screen } from '@testing-library/react';
import SearchingIndicator from '../../../src/ui/components/SearchingIndicator';

describe('SearchingIndicator', () => {
    it('renders "Searching" text', () => {
        render(<SearchingIndicator />);
        expect(screen.getByText('Searching')).toBeInTheDocument();
    });
});
