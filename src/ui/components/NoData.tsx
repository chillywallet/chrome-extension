import React from 'react';
import { Images } from '../../shared/utils/Images';

type Props = {
    children: string | React.ReactNode;
};

export default React.memo((props: Props) => {
    return (
        <div className="flex flex-1 flex-col items-center py-5">
            <img src={Images.noResult} className="w-12 h-12 mb-2" alt="No Result" />
            <div className="text-center text-sm">{props.children}</div>
        </div>
    );
});
