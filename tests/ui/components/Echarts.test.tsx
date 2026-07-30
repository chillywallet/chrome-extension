import React from 'react';
import { render } from '@testing-library/react';
import Echarts from '../../../src/ui/components/Echarts';

describe('Echarts', () => {
    beforeEach(() => {
        (window as any).echarts = {
            init: jest.fn(() => ({
                setOption: jest.fn(),
                dispose: jest.fn(),
                on: jest.fn(),
                off: jest.fn(),
            })),
        };
    });

    it('renders a chart container div', () => {
        const { container } = render(<Echarts />);
        expect(container.querySelector('#main-chart')).toBeInTheDocument();
    });

    it('initializes echarts on mount', () => {
        render(<Echarts />);
        expect((window as any).echarts.init).toHaveBeenCalled();
    });

    it('subscribes to hideTip when onHideTip is provided', () => {
        const handle = {
            setOption: jest.fn(),
            dispose: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
        };
        (window as any).echarts.init = jest.fn(() => handle);
        render(<Echarts onHideTip={jest.fn()} />);
        expect(handle.on).toHaveBeenCalledWith('hideTip', expect.any(Function));
    });

    it('applies inline style to the container', () => {
        const { container } = render(<Echarts style={{ width: 100 }} />);
        expect((container.querySelector('#main-chart') as HTMLElement).style.width).toBe('100px');
    });

    it('invokes onHideTip when the hideTip handler fires', () => {
        let captured: (() => void) | null = null;
        const handle = {
            setOption: jest.fn(),
            dispose: jest.fn(),
            on: jest.fn((evt: string, cb: () => void) => {
                if (evt === 'hideTip') captured = cb;
            }),
            off: jest.fn(),
        };
        (window as any).echarts.init = jest.fn(() => handle);
        const onHideTip = jest.fn();
        render(<Echarts onHideTip={onHideTip} />);
        expect(captured).not.toBeNull();
        // Invoke the captured handler -> covers line 58 (onHideTip()).
        captured!();
        expect(onHideTip).toHaveBeenCalled();
    });

    it('unsubscribes hideTip when onHideTip changes', () => {
        const handle = {
            setOption: jest.fn(),
            dispose: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
        };
        (window as any).echarts.init = jest.fn(() => handle);
        const { rerender } = render(<Echarts onHideTip={jest.fn()} />);
        // Trigger the cleanup of the hideTip effect by passing a new onHideTip ref.
        rerender(<Echarts onHideTip={jest.fn()} />);
        // Covers line 67 (chartInstanceRef.current.off('hideTip', handler))
        expect(handle.off).toHaveBeenCalledWith('hideTip', expect.any(Function));
    });

    it('updates options when chart props change', () => {
        const handle = {
            setOption: jest.fn(),
            dispose: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
        };
        (window as any).echarts.init = jest.fn(() => handle);
        const { rerender } = render(<Echarts series={[{ type: 'line', data: [1] }]} />);
        rerender(<Echarts series={[{ type: 'line', data: [2] }]} />);
        expect(handle.setOption).toHaveBeenCalledTimes(2);
    });

    it('disposes the chart instance and skips off-cleanup on unmount', () => {
        const handle = {
            setOption: jest.fn(),
            dispose: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
        };
        (window as any).echarts.init = jest.fn(() => handle);
        const { unmount } = render(<Echarts onHideTip={jest.fn()} />);
        unmount();
        // The init effect cleanup runs first and nullifies the ref. The hideTip
        // cleanup then sees null and skips the off-call -> exercises the false
        // branch on line 65 (`if (chartInstanceRef.current)`).
        expect(handle.dispose).toHaveBeenCalled();
    });

    it('handles a null instance gracefully', () => {
        // echarts.init returns null -> chartInstanceRef.current is null.
        (window as any).echarts.init = jest.fn(() => null);
        const { rerender, unmount } = render(
            <Echarts series={[{ data: [] }]} onHideTip={jest.fn()} />,
        );
        // Trigger the setOption effect on rerender; it should early-return because
        // chartInstanceRef.current is null.
        rerender(<Echarts series={[{ data: [1] }]} onHideTip={jest.fn()} />);
        // Unmount cleanly when the cleanup `if (chartInstanceRef.current)` is false.
        unmount();
    });

});
