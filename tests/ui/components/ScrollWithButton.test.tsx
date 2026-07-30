import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import ScrollWithButton from '../../../src/ui/components/ScrollWithButton';

describe('ScrollWithButton', () => {
    it('renders the children inside the scroll container', () => {
        const { getByText } = render(
            <ScrollWithButton className="h-10">
                <div>scroll-content</div>
            </ScrollWithButton>,
        );
        expect(getByText('scroll-content')).toBeInTheDocument();
    });

    it('hides the scroll button by default when content is not scrollable', () => {
        const { container } = render(
            <ScrollWithButton className="h-10">
                <div>x</div>
            </ScrollWithButton>,
        );
        const button = container.querySelector('.absolute');
        expect(button?.className).toContain('opacity-0');
    });

    it('clicking the button calls scrollTo on the inner content', () => {
        const scrollToSpy = jest.fn();
        const original = HTMLDivElement.prototype.scrollTo;
        HTMLDivElement.prototype.scrollTo = scrollToSpy as any;

        const { container } = render(
            <ScrollWithButton className="h-10">
                <div style={{ height: 1000 }}>content</div>
            </ScrollWithButton>,
        );

        const btn = container.querySelector('.absolute') as HTMLElement;
        fireEvent.click(btn);
        expect(scrollToSpy).toHaveBeenCalled();
        HTMLDivElement.prototype.scrollTo = original;
    });

    it('triggers a scroll handler and re-evaluates state without crashing', () => {
        const { container } = render(
            <ScrollWithButton className="h-10">
                <div>z</div>
            </ScrollWithButton>,
        );
        const scrollable = container.querySelector('.overflow-y-auto') as HTMLElement;
        act(() => {
            Object.defineProperty(scrollable, 'scrollTop', { value: 0, configurable: true });
            Object.defineProperty(scrollable, 'scrollHeight', { value: 100, configurable: true });
            Object.defineProperty(scrollable, 'clientHeight', { value: 50, configurable: true });
            fireEvent.scroll(scrollable);
        });
        expect(scrollable).toBeInTheDocument();
    });

    it('reacts to window resize without throwing', () => {
        render(
            <ScrollWithButton className="h-10">
                <div>x</div>
            </ScrollWithButton>,
        );
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
    });

    it('shows the button (opacity-100) when content is scrollable and not at bottom', () => {
        const { container } = render(
            <ScrollWithButton className="h-10">
                <div>content</div>
            </ScrollWithButton>,
        );
        const scrollable = container.querySelector('.overflow-y-auto') as HTMLElement;
        Object.defineProperty(scrollable, 'scrollHeight', { value: 500, configurable: true });
        Object.defineProperty(scrollable, 'clientHeight', { value: 100, configurable: true });
        Object.defineProperty(scrollable, 'scrollTop', { value: 0, configurable: true });
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
        act(() => {
            fireEvent.scroll(scrollable);
        });
        const button = container.querySelector('.absolute');
        expect(button?.className).toContain('opacity-100');
    });
});
