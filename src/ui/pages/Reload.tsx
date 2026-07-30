import React, { useCallback } from 'react';
import Browser from 'webextension-polyfill';
import { Images } from '../../shared/utils/Images';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const onReloadPress = useCallback(() => {
        setTimeout(() => {
            Browser.runtime.reload();
        }, 500);
    }, []);

    return (
        <div className="flex flex-col justify-center items-center h-full p-10 bg-white dark:bg-dark">
            <img className="w-100 h-100 mb-10" src={Images.logo128} alt="" loading="lazy" />
            <p className="text-sm text-black dark:text-white mt-3 text-center">
                Chilly encountered an unexpected issue. Please reload the extension and try again.
            </p>
            <button
                onClick={e => {
                    onReloadPress();
                    e.preventDefault();
                }}
                className="btn btn-primary w-full mt-10">
                Reload
            </button>
        </div>
    );
});
