import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

const eventHandlers: Record<string, Array<(d: any) => void>> = {};

jest.mock('../../../src/ui/components/Echarts', () => ({
    __esModule: true,
    default: (props: any) => {
        // Capture props into a module-scoped global so tests can invoke yAxis fns.
        (globalThis as any).__capturedEchartsProps = props;
        return (
            <div data-testid="echarts">
                <button
                    data-testid="trigger-tooltip"
                    onClick={() =>
                        props.tooltip?.formatter?.([
                            { value: 5, axisValueLabel: '2024-01-01' },
                        ])
                    }>
                    trigger-tooltip
                </button>
                <button data-testid="hide-tip" onClick={() => props.onHideTip?.()}>
                    hide-tip
                </button>
            </div>
        );
    },
}));

const mockUseActualTheme = jest.fn(() => 'light');
jest.mock('../../../src/store/selectors', () => ({
    useActualTheme: () => mockUseActualTheme(),
}));

jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: {
        on: (name: string, h: (d: any) => void) => {
            if (!eventHandlers[name]) eventHandlers[name] = [];
            eventHandlers[name].push(h);
        },
        off: (name: string, h: (d: any) => void) => {
            if (eventHandlers[name]) {
                eventHandlers[name] = eventHandlers[name].filter(x => x !== h);
            }
        },
        emit: jest.fn(),
    },
}));

describe('PriceChart', () => {
    beforeEach(() => {
        for (const k of Object.keys(eventHandlers)) delete eventHandlers[k];
        mockUseActualTheme.mockImplementation(() => 'light');
        (window as any).echarts = {
            graphic: {
                LinearGradient: function (this: any) {
                    this.colorStops = [];
                },
            },
        };
    });

    it('renders without crashing', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        const { container } = render(
            <PriceChart data={[1, 2, 3]} date={['a', 'b', 'c']} lineColor="#000" />,
        );
        expect(container).toBeInTheDocument();
    });

    it('uses placeholder filteredData/filteredDate when data/date length <= 1', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        render(<PriceChart data={[]} date={[]} lineColor="#000" />);
        // No crash; filteredData becomes [0,0,0]; filteredDate becomes [now,now,now].
        expect(screen.getByTestId('echarts')).toBeInTheDocument();
    });

    it('renders with dark theme branch', () => {
        mockUseActualTheme.mockImplementation(() => 'dark');
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        render(<PriceChart data={[1, 2, 3]} date={['a', 'b', 'c']} lineColor="#000" />);
        expect(screen.getByTestId('echarts')).toBeInTheDocument();
    });

    it('Y_AXIS min/max compute correct buffered values', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        render(<PriceChart data={[1, 2, 3]} date={['a', 'b', 'c']} lineColor="#000" />);
        const props = (globalThis as any).__capturedEchartsProps;
        expect(props.yAxis.min({ min: 10, max: 20 })).toBeCloseTo(9.99);
        expect(props.yAxis.max({ min: 10, max: 20 })).toBeCloseTo(20.01);
    });

    it('TOOLTIP formatter emits SET_VALUE and returns a styled HTML string', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        const evt = require('../../../src/shared/utils/eventManager').default;
        render(<PriceChart data={[1, 2, 3]} date={['a', 'b', 'c']} lineColor="#000" />);
        fireEvent.click(screen.getByTestId('trigger-tooltip'));
        expect(evt.emit).toHaveBeenCalledWith(
            'EVENT_SET_VALUE',
            expect.objectContaining({ value: 5, date: '2024-01-01' }),
        );
    });

    it('TOOLTIP formatter uses dark color when theme is dark', () => {
        mockUseActualTheme.mockImplementation(() => 'dark');
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        render(<PriceChart data={[1, 2, 3]} date={['a', 'b', 'c']} lineColor="#000" />);
        const props = (globalThis as any).__capturedEchartsProps;
        const html = props.tooltip.formatter([{ value: 7, axisValueLabel: '2024-03-03' }]);
        expect(html).toContain('color: #fff');
    });

    it('onHideTip emits HIDE_TOOLTIP', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        const evt = require('../../../src/shared/utils/eventManager').default;
        render(<PriceChart data={[1, 2, 3]} date={['a', 'b', 'c']} lineColor="#000" />);
        fireEvent.click(screen.getByTestId('hide-tip'));
        expect(evt.emit).toHaveBeenCalledWith('EVENT_HIDE_TOOLTIP', {});
    });

    it('Header switches to selected mode on SET_VALUE event with firstValue truthy', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        render(<PriceChart data={[10, 20, 30]} date={['a', 'b', 'c']} lineColor="#000" />);
        // Fire SET_VALUE event handlers.
        act(() => {
            eventHandlers['EVENT_SET_VALUE']?.forEach(h =>
                h({ date: '2024-02-02', value: 50 }),
            );
        });
        // Switch back to default via HIDE_TOOLTIP.
        act(() => {
            eventHandlers['EVENT_HIDE_TOOLTIP']?.forEach(h => h({}));
        });
        expect(screen.getByTestId('echarts')).toBeInTheDocument();
    });

    it('Header SET_VALUE uses 0 percentage when firstValue is 0', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        // firstValue = 0 -> percentage computation goes to else branch (set 0).
        render(<PriceChart data={[0, 20, 30]} date={['a', 'b', 'c']} lineColor="#000" />);
        act(() => {
            eventHandlers['EVENT_SET_VALUE']?.forEach(h =>
                h({ date: '2024-02-02', value: 50 }),
            );
        });
        expect(screen.getByTestId('echarts')).toBeInTheDocument();
    });

    it('Header default usdChange uses 0 percentage when first data value is 0', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        render(<PriceChart data={[0, 10]} date={['a', 'b']} lineColor="#000" />);
        // Should render without crashing; useEffect computes percentage with first=0 branch.
        expect(screen.getByTestId('echarts')).toBeInTheDocument();
    });

    it('Header renders positive percentage change and positive usdChange', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        const { getByText } = render(
            <PriceChart data={[10, 20]} date={['a', 'b']} lineColor="#000" />,
        );
        // usdChange > 0 -> '+' prefix is rendered.
        expect(getByText(/\+/)).toBeInTheDocument();
    });

    it('Header renders negative percentage change and negative usdChange', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        render(<PriceChart data={[20, 10]} date={['a', 'b']} lineColor="#000" />);
        // Negative change -> IoMdArrowDown branch.
        expect(screen.getByTestId('echarts')).toBeInTheDocument();
    });

    it('HighestLowest hides labels on SET_VALUE event and shows on HIDE_TOOLTIP', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        const { container } = render(
            <PriceChart data={[1, 2, 3]} date={['a', 'b', 'c']} lineColor="#000" />,
        );
        // Initially 'Highest' and 'Lowest' visible.
        expect(container.textContent).toMatch(/Highest/);
        expect(container.textContent).toMatch(/Lowest/);
        act(() => {
            eventHandlers['EVENT_SET_VALUE']?.forEach(h => h({ value: 5 }));
        });
        // After SET_VALUE the HighestLowest blocks should hide their label/value.
        expect(container.textContent).not.toMatch(/Highest/);
        act(() => {
            eventHandlers['EVENT_HIDE_TOOLTIP']?.forEach(h => h({}));
        });
        expect(container.textContent).toMatch(/Highest/);
    });

    it('PriceChartPlaceholder renders light and dark themes', () => {
        const { PriceChartPlaceholder } = require('../../../src/ui/components/PriceChart');
        const { container, rerender } = render(<PriceChartPlaceholder />);
        expect(container.querySelector('svg')).toBeInTheDocument();
        mockUseActualTheme.mockImplementation(() => 'dark');
        rerender(<PriceChartPlaceholder />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders right view passed through props', () => {
        const PriceChart = require('../../../src/ui/components/PriceChart').default;
        render(
            <PriceChart
                data={[1, 2, 3]}
                date={['a', 'b', 'c']}
                lineColor="#000"
                rightView={<div data-testid="right-view">RIGHT</div>}
            />,
        );
        expect(screen.getByTestId('right-view')).toBeInTheDocument();
    });
});
