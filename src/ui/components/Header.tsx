import React from 'react';
import { GoArrowLeft as BackIcon, GoX as CloseIcon } from 'react-icons/go';
import { useHistory } from 'react-router-dom';
import { DEFAULT_ROUTE } from '../../shared/constants/routes';

type Props = {
    title?: string | React.ReactNode;
    onBackPress?: () => void;
    hasBackButton?: boolean;
    onClosePress?: () => void;
    action?: React.ReactNode;
};

export default React.memo<Props>((props: Props) => {
    const { onBackPress, onClosePress, title = '', hasBackButton = true, action } = props;
    const history = useHistory();

    return (
        <div className="flex flex-row items-center w-full h-12 border-b border-slate-100 dark:border-darkline/40 pr-3 pl-3 shrink-0">
            {hasBackButton && (
                <button
                    type="button"
                    className="p-1.5 -ml-1 rounded-full text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-colors transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={e => {
                        e.preventDefault();
                        if (onBackPress) {
                            onBackPress();
                        } else {
                            if (window.history.length > 1) {
                                history.goBack();
                            } else {
                                history.replace(DEFAULT_ROUTE);
                            }
                        }
                    }}
                    aria-label="Go back">
                    <BackIcon size={24} />
                </button>
            )}
            <div className="text-base font-semibold text-black dark:text-white flex-1 mx-2 cursor-default truncate min-w-0">
                {title}
            </div>

            {action}

            {onClosePress && (
                <button
                    type="button"
                    className="ml-1 p-2 rounded-full text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-colors transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={e => {
                        e.preventDefault();
                        onClosePress();
                    }}
                    aria-label="Close">
                    <CloseIcon size={22} strokeWidth={1} />
                </button>
            )}
        </div>
    );
});
