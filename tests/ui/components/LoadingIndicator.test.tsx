import React from 'react';
import { render } from '@testing-library/react';
import LoadingIndicator from '../../../src/ui/components/LoadingIndicator';
import { useIsShowLoading } from '../../../src/store/selectors';

jest.mock('../../../src/store/selectors', () => ({
    useIsShowLoading: jest.fn(),
}));

describe('LoadingIndicator', () => {
    it('renders nothing when not loading', () => {
        (useIsShowLoading as jest.Mock).mockReturnValue(false);
        const { container } = render(<LoadingIndicator />);
        expect(container.firstChild).toBeNull();
    });

    it('renders a spinner when loading', () => {
        (useIsShowLoading as jest.Mock).mockReturnValue(true);
        const { container } = render(<LoadingIndicator />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });
});
