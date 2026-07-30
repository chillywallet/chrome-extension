import React from 'react';
import { HomeTabType } from '../../shared/types/Home';

type Props = {
    isAAWallet: boolean;
    className?: string;
};

export default React.memo<Props>((props: Props) => {
    const { isAAWallet, className } = props;

    if (!isAAWallet) {
        return null;
    }

    return (
        <div
            className={
                'flex flex-row items-center text-white px-2 py-1 rounded-md h-[25px] text-xs whitespace-nowrap ' +
                'bg-sky-500' +
                ` ${className ?? ''}`
            }>
            <p className="text-nowrap">{HomeTabType.SmartWallet}</p>
        </div>
    );
});
