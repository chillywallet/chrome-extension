import React from 'react';

type Props = {
    label: string;
    value: React.ReactNode;
    className?: string;
};

export default React.memo<Props>((props: Props) => {
    const { label, value, className = '' } = props;

    return (
        <div className={`flex flex-row items-center justify-between mb-2 ${className}`}>
            <div className="text-xs text-gray-400">{label}</div>
            <div className="text-xs text-gray-400 text-right">{value}</div>
        </div>
    );
});
