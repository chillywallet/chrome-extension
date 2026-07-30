import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Header from '../../../src/ui/components/Header';

const mockGoBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('react-router-dom', () => ({
    useHistory: () => ({ goBack: mockGoBack, replace: mockReplace }),
}));

jest.mock('../../../src/shared/constants/routes', () => ({
    DEFAULT_ROUTE: '/home',
}));

describe('Header', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders title text', () => {
        render(<Header title="Hello" />);
        expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('omits the back button when hasBackButton is false', () => {
        render(<Header title="X" hasBackButton={false} />);
        expect(screen.queryByLabelText('Go back')).toBeNull();
    });

    it('calls onBackPress when provided', () => {
        const onBackPress = jest.fn();
        render(<Header title="X" onBackPress={onBackPress} />);
        fireEvent.click(screen.getByLabelText('Go back'));
        expect(onBackPress).toHaveBeenCalled();
        expect(mockGoBack).not.toHaveBeenCalled();
    });

    it('uses history.goBack when no handler and there is history', () => {
        Object.defineProperty(window.history, 'length', { configurable: true, value: 5 });
        render(<Header title="X" />);
        fireEvent.click(screen.getByLabelText('Go back'));
        expect(mockGoBack).toHaveBeenCalled();
    });

    it('replaces with DEFAULT_ROUTE when history is empty', () => {
        Object.defineProperty(window.history, 'length', { configurable: true, value: 1 });
        render(<Header title="X" />);
        fireEvent.click(screen.getByLabelText('Go back'));
        expect(mockReplace).toHaveBeenCalledWith('/home');
    });

    it('shows close button only when onClosePress is provided', () => {
        const onClosePress = jest.fn();
        const { rerender } = render(<Header title="X" />);
        expect(screen.queryByLabelText('Close')).toBeNull();
        rerender(<Header title="X" onClosePress={onClosePress} />);
        fireEvent.click(screen.getByLabelText('Close'));
        expect(onClosePress).toHaveBeenCalled();
    });

    it('renders an action node next to the title', () => {
        render(<Header title="X" action={<button>Save</button>} />);
        expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('uses default empty title when prop omitted', () => {
        // @ts-expect-error intentionally omit title to exercise the `= ''` default
        const { container } = render(<Header />);
        expect(container).toBeTruthy();
    });
});
