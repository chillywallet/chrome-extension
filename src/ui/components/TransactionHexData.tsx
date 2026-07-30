import { toBuffer } from '@ethereumjs/util';
import React from 'react';
import { FaFileAlt } from 'react-icons/fa';

type Props = {
    title: string;
    data: string | undefined;
};

export default React.memo<Props>((props: Props) => {
    const { title, data } = props;

    return (
        <>
            <div className="flex flex-row items-center text-primary mb-2">
                <FaFileAlt className="mr-2" />
                {title}
            </div>
            <div className="overflow-y-auto h-[100px]">
                {data ? (
                    <div className="flex flex-col">
                        Hex Data: {toBuffer(data).length} bytes
                        <p className="break-all mt-1">{data}</p>
                    </div>
                ) : null}
            </div>
        </>
    );
});
