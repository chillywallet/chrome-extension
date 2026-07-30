import React, { useEffect, useRef } from 'react';

type UseEChartsOptions = {
    style?: any;
    grid?: any;
    tooltip?: any;
    xAxis?: any;
    yAxis?: any;
    series?: any[];
    onHideTip?: () => void;
};

export default React.memo<UseEChartsOptions>((props: UseEChartsOptions) => {
    const { style, onHideTip, grid, tooltip, xAxis, yAxis, series } = props;
    const chartRef = useRef<any>(null);
    const chartInstanceRef = useRef<any>(null);

    // Initialize chart instance only once
    useEffect(() => {
        if (!chartRef.current) return;

        //@ts-ignore
        chartInstanceRef.current = window.echarts.init(chartRef.current);

        // Cleanup only on unmount
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.dispose();
                chartInstanceRef.current = null;
            }
        };
    }, []);

    // Update chart options when props change
    useEffect(() => {
        if (!chartInstanceRef.current) return;

        chartInstanceRef.current.setOption(
            {
                grid,
                tooltip,
                xAxis,
                yAxis,
                series,
            },
            {
                notMerge: false, // Merge with previous options
                lazyUpdate: false,
            }
        );
    }, [grid, tooltip, xAxis, yAxis, series]);

    // Handle hideTip event
    useEffect(() => {
        if (!chartInstanceRef.current || !onHideTip) return;

        const handler = () => {
            onHideTip();
        };

        // @ts-ignore
        chartInstanceRef.current.on('hideTip', handler);

        return () => {
            if (chartInstanceRef.current) {
                // @ts-ignore
                chartInstanceRef.current.off('hideTip', handler);
            }
        };
    }, [onHideTip]);

    return <div ref={chartRef} style={style} id="main-chart"></div>;
});
