import React from 'react';
import { FaSpinner } from 'react-icons/fa';

export default React.memo(() => {
    return (
        <div className='absolute bottom-3 left-0 w-full'>
            <div className='flex flex-row items-center justify-center'>
                <div className="flex flex-row items-center justify-center px-3 py-2 bg-white dark:bg-darker border rounded-md cursor-default">
                    <FaSpinner className="custom-anim-fast text-3lg z-999" />

                    <div className='ml-2 text-sm'>Loading More</div>
                </div>
            </div>
        </div>
    );
});
