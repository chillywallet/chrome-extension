import React from 'react';
import { ChartFilterType } from '../../shared/types/Chart';

type Props = {
    chartTypes: ChartFilterType[];
    selectedType: ChartFilterType;
    onTypeChange: (type: ChartFilterType) => void;
    labels?: Record<string, string>;
    className?: string;
};

const DEFAULT_LABELS: Record<string, string> = {
    day: '24H',
    week: '1 W',
    month: '1 M',
    year: '1 Y',
    all: 'ALL',
};

export default React.memo<Props>((props: Props) => {
    const {
        chartTypes,
        selectedType,
        onTypeChange,
        labels = DEFAULT_LABELS,
        className = 'px-10 flex flex-row items-center justify-center gap-3 text-xs',
    } = props;

    return (
        <div className={className}>
            {chartTypes.map(type => {
                const label = labels[type] || type;
                const selected = type === selectedType;
                return (
                    <button
                        key={type}
                        className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
                            selected ? 'bg-primary text-white' : 'bg-transparent text-slate-500'
                        }`}
                        onClick={() => {
                            onTypeChange(type);
                        }}>
                        {label}
                    </button>
                );
            })}
        </div>
    );
});
