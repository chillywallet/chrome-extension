import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TokenAllowanceData from '../../../src/ui/components/TokenAllowanceData';

describe('TokenAllowanceData', () => {
    it('shows the View details toggle', () => {
        render(<TokenAllowanceData data="0xdata" />);
        expect(screen.getByText(/View details/)).toBeInTheDocument();
    });

    it('expands to reveal Approve function and data on click', () => {
        render(<TokenAllowanceData data="0xdeadbeef" />);
        fireEvent.click(screen.getByText(/View details/));
        expect(screen.getByText(/Function: Approve/)).toBeInTheDocument();
        expect(screen.getByText('0xdeadbeef')).toBeInTheDocument();
    });

    it('collapses back on second click', () => {
        render(<TokenAllowanceData data="0xfoo" />);
        const toggle = screen.getByText(/View details/);
        fireEvent.click(toggle);
        fireEvent.click(toggle);
        expect(screen.queryByText(/Function: Approve/)).toBeNull();
    });

    it('scrolls to bottom of #scrollable container when toggled', () => {
        jest.useFakeTimers();
        // Create scrollable element
        const scrollableEl = document.createElement('div');
        scrollableEl.id = 'scrollable';
        const scrollToSpy = jest.fn();
        Object.defineProperty(scrollableEl, 'scrollHeight', { value: 999, configurable: true });
        scrollableEl.scrollTo = scrollToSpy as any;
        document.body.appendChild(scrollableEl);

        render(<TokenAllowanceData data="0xdata" />);
        fireEvent.click(screen.getByText(/View details/));
        jest.advanceTimersByTime(300);
        expect(scrollToSpy).toHaveBeenCalledWith({ top: 999, behavior: 'smooth' });

        document.body.removeChild(scrollableEl);
        jest.useRealTimers();
    });

    it('does not throw when #scrollable element is not in the document', () => {
        jest.useFakeTimers();
        // Ensure no scrollable element exists
        const existing = document.getElementById('scrollable');
        if (existing) existing.remove();

        render(<TokenAllowanceData data="0xnoscroll" />);
        fireEvent.click(screen.getByText(/View details/));
        // setTimeout fires - should not throw
        expect(() => jest.advanceTimersByTime(300)).not.toThrow();
        jest.useRealTimers();
    });
});
