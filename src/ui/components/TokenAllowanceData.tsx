import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp, FaFileAlt } from 'react-icons/fa';

type Props = {
    data: string;
};

export default React.memo<Props>((props: Props) => {
    const { data } = props;
    const [isShowDetail, setIsShowDetail] = useState<boolean>(false);

    return (
        <>
            <div
                className="flex flex-row items-center justify-center text-xs text-center text-primary hover:underline cursor-pointer mb-3"
                onClick={() => {
                    setIsShowDetail(!isShowDetail);
                    setTimeout(() => {
                        const element = document.getElementById('scrollable');
                        if (element) {
                            //smooth scroll to bottom
                            element.scrollTo({
                                top: element.scrollHeight,
                                behavior: 'smooth',
                            });
                        }
                    }, 200);
                }}>
                View details{' '}
                {isShowDetail ? (
                    <FaChevronUp className="ml-2" />
                ) : (
                    <FaChevronDown className="ml-2" />
                )}
            </div>

            {isShowDetail && (
                <div className="text-xs">
                    <div className="flex flex-row items-center text-primary mb-2">
                        <FaFileAlt className="mr-2" />
                        Data
                    </div>
                    <div className="flex flex-col">
                        Function: Approve
                        <p className="break-all">{data}</p>
                    </div>
                </div>
            )}
        </>
    );
});
