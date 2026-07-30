import React from 'react';

type Props = {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    /** Optional label beside the checkbox (string or JSX). */
    title?: React.ReactNode;
    className?: string;
};

export default React.memo<Props>((props: Props) => {
    const { checked, onChange, title, className, disabled } = props;

    return (
        <label
            className={[
                'flex min-w-0 flex-row items-center',
                disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
            aria-disabled={disabled ?? false}
            onClick={() => {
                if (disabled) {
                    return;
                }
                onChange(!checked);
            }}>
            <div className="mr-1 inline-flex shrink-0 items-center">
                <span className="relative flex items-center">
                    {checked ? (
                        <div className="flex h-5 w-5 flex-row items-center justify-center rounded bg-primary text-white shadow">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                stroke="currentColor"
                                strokeWidth={'1'}>
                                <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"></path>
                            </svg>
                        </div>
                    ) : (
                        <div className="h-5 w-5 rounded border border-slate-300 bg-transparent shadow dark:border-slate-500"></div>
                    )}
                </span>
            </div>

            {title ?? null}
        </label>
    );
});
