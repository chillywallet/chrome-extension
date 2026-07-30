import React from 'react';
import { FaSpinner } from 'react-icons/fa';
import { useIsShowLoading } from '../../store/selectors';

export default React.memo(() => {
    const isLoading = useIsShowLoading();

    if (!isLoading) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 w-screen h-screen bg-darker/50 backdrop-blur-[2px] flex justify-center items-center z-50">
            <FaSpinner className="custom-anim-fast text-accent text-3xl z-999" />
        </div>
    );
});
