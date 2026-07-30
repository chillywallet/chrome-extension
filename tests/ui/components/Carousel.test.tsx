import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import Carousel from '../../../src/ui/components/Carousel';

describe('Carousel', () => {
    function slideTrack(container) {
        return container.querySelector('.flex.transition-transform');
    }

    function dotIndicators(container) {
        return container.querySelectorAll('.w-3.h-3.rounded-full');
    }

    it('merges className onto the root container', () => {
        const { container } = render(
            <Carousel slides={[<span key="a">A</span>]} className="extra-carousel-class" />,
        );
        expect(container.firstChild).toHaveClass('extra-carousel-class', 'relative', 'w-full', 'overflow-hidden');
    });

    it('renders a single slide without navigation controls', () => {
        render(<Carousel slides={[<div key="one">Only slide</div>]} />);

        expect(screen.getByText('Only slide')).toBeInTheDocument();
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('moves the track with next and previous, wrapping at the ends', async () => {
        const { container } = render(
            <Carousel
                slides={[
                    <div key="0">Slide A</div>,
                    <div key="1">Slide B</div>,
                    <div key="2">Slide C</div>,
                ]}
            />,
        );

        const track = slideTrack(container);
        const [prev, next] = screen.getAllByRole('button');

        expect(track.style.transform).toBe('translateX(-0%)');

        await userEvent.click(next);
        expect(track.style.transform).toBe('translateX(-100%)');

        await userEvent.click(next);
        expect(track.style.transform).toBe('translateX(-200%)');

        await userEvent.click(next);
        expect(track.style.transform).toBe('translateX(-0%)');

        await userEvent.click(prev);
        expect(track.style.transform).toBe('translateX(-200%)');

        await userEvent.click(prev);
        expect(track.style.transform).toBe('translateX(-100%)');

        await userEvent.click(prev);
        expect(track.style.transform).toBe('translateX(-0%)');
    });

    it('selects a slide when its dot is clicked and highlights the active dot', async () => {
        const { container } = render(
            <Carousel
                slides={[
                    <div key="0">A</div>,
                    <div key="1">B</div>,
                    <div key="2">C</div>,
                ]}
            />,
        );

        const track = slideTrack(container);
        const dots = dotIndicators(container);
        expect(dots).toHaveLength(3);
        expect(dots[0]).toHaveClass('bg-primary');
        expect(dots[1]).toHaveClass('bg-gray-400');

        await userEvent.click(dots[2]);
        expect(track.style.transform).toBe('translateX(-200%)');
        expect(dots[2]).toHaveClass('bg-primary');
        expect(dots[0]).toHaveClass('bg-gray-400');

        await userEvent.click(dots[0]);
        expect(track.style.transform).toBe('translateX(-0%)');
    });

    it('advances on autoPlayInterval and wraps', () => {
        jest.useFakeTimers();
        const { container } = render(
            <Carousel
                autoPlayInterval={1000}
                slides={[
                    <div key="0">A</div>,
                    <div key="1">B</div>,
                ]}
            />,
        );

        const track = slideTrack(container);
        expect(track.style.transform).toBe('translateX(-0%)');

        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(track.style.transform).toBe('translateX(-100%)');

        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(track.style.transform).toBe('translateX(-0%)');

        jest.useRealTimers();
    });

    it('clears the existing auto-play interval when navigation restarts the timer', async () => {
        jest.useFakeTimers();
        const clearSpy = jest.spyOn(global, 'clearInterval');

        render(
            <Carousel
                autoPlayInterval={1000}
                slides={[
                    <div key="0">A</div>,
                    <div key="1">B</div>,
                ]}
            />,
        );

        clearSpy.mockClear();

        const [, next] = screen.getAllByRole('button');
        await userEvent.click(next);

        expect(clearSpy).toHaveBeenCalled();

        clearSpy.mockRestore();
        jest.useRealTimers();
    });

    it('does not set an interval when autoPlayInterval is 0', () => {
        jest.useFakeTimers();
        const setIntervalSpy = jest.spyOn(global, 'setInterval');

        render(
            <Carousel
                autoPlayInterval={0}
                slides={[
                    <div key="0">A</div>,
                    <div key="1">B</div>,
                ]}
            />,
        );

        jest.advanceTimersByTime(60_000);
        expect(setIntervalSpy).not.toHaveBeenCalled();

        setIntervalSpy.mockRestore();
        jest.useRealTimers();
    });

    it('clears the auto-play interval on unmount', () => {
        jest.useFakeTimers();
        const clearSpy = jest.spyOn(global, 'clearInterval');

        const { unmount } = render(
            <Carousel
                autoPlayInterval={500}
                slides={[
                    <div key="0">A</div>,
                    <div key="1">B</div>,
                ]}
            />,
        );

        unmount();
        expect(clearSpy).toHaveBeenCalled();

        clearSpy.mockRestore();
        jest.useRealTimers();
    });
});
