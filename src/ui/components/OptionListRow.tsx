import React from 'react';
import { FaChevronRight } from 'react-icons/fa';
import RadioButton from './RadioButton';

/** Full-width, keyboard-friendly row; chevron nudge on hover */
export const optionListRowInteractive =
    'group relative w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium transition-[background-color,transform,color] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-dark disabled:cursor-not-allowed disabled:opacity-45';

export const optionListRowBody =
    'text-slate-800 dark:text-slate-100 hover:bg-slate-50/90 dark:hover:bg-dark active:scale-[0.99]';

export const optionListRowDivider = 'border-b border-slate-100 dark:border-darkline';

const iconWrapBase =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden [&_img]:max-h-4 [&_img]:w-auto [&_img]:max-w-[2rem] [&_img]:object-contain';

const iconWrapAccent =
    'bg-primary/[0.12] text-primary ring-1 ring-primary/20 dark:bg-primary/20 dark:ring-primary/35';

/** Light tile so vendor marks (often dark) stay on-brand in light and dark UI */
const iconWrapNeutral =
    'bg-white text-slate-800 ring-1 ring-slate-200/90 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)] dark:bg-white dark:text-slate-900 dark:ring-slate-600/90';

export type OptionListRowProps = {
    onClick: () => void;
    label: string;
    icon: React.ReactNode;
    withBottomBorder?: boolean;
    disabled?: boolean;
    /** Secondary line under the title */
    description?: string;
    /** @default 'accent' */
    iconSurface?: 'accent' | 'neutral';
    /** @default 'navigate' — `select` shows a radio instead of a chevron */
    mode?: 'navigate' | 'select';
    /** Used with `mode="select"` */
    selected?: boolean;
    /** Non-interactive row; shows a trailing label instead of chevron/radio */
    comingSoon?: boolean;
};

const OptionListRow = React.memo<OptionListRowProps>(function OptionListRow({
    disabled = false,
    onClick,
    label,
    description,
    withBottomBorder = false,
    icon,
    iconSurface = 'accent',
    mode = 'navigate',
    selected = false,
    comingSoon = false,
}) {
    const iconWrap = `${iconWrapBase} ${iconSurface === 'neutral' ? iconWrapNeutral : iconWrapAccent}`;
    const isDisabled = disabled || comingSoon;
    const rowClassName = `${optionListRowInteractive} ${comingSoon ? '' : optionListRowBody} ${
        withBottomBorder ? optionListRowDivider : ''
    } ${mode === 'select' && selected && !comingSoon ? 'bg-ice/50 dark:bg-header/50' : ''} ${
        comingSoon ? 'cursor-default opacity-70' : ''
    }`;

    const rowContent = (
        <>
            <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className={iconWrap} aria-hidden>
                    {icon}
                </span>
                <span className="min-w-0 grow pr-1 text-left leading-snug">
                    <span className="block">{label}</span>
                    {description ? (
                        <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">
                            {description}
                        </span>
                    ) : null}
                </span>
            </span>
            {comingSoon ? (
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    Coming Soon
                </span>
            ) : mode === 'select' ? (
                <span className="pointer-events-none shrink-0" aria-hidden>
                    <RadioButton checked={selected} onChange={() => {}} />
                </span>
            ) : (
                <FaChevronRight
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-slate-500"
                    aria-hidden
                />
            )}
        </>
    );

    if (mode === 'select' && !comingSoon) {
        return (
            <div
                role="radio"
                aria-checked={selected}
                aria-disabled={isDisabled}
                tabIndex={isDisabled ? -1 : 0}
                className={`group ${rowClassName} ${isDisabled ? '' : 'cursor-pointer'}`}
                onClick={isDisabled ? undefined : onClick}
                onKeyDown={
                    isDisabled
                        ? undefined
                        : e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onClick();
                              }
                          }
                }>
                {rowContent}
            </div>
        );
    }

    if (comingSoon) {
        return (
            <div aria-disabled className={`group ${rowClassName}`}>
                {rowContent}
            </div>
        );
    }

    return (
        <button
            type="button"
            disabled={isDisabled}
            className={`group ${rowClassName}`}
            onClick={onClick}>
            {rowContent}
        </button>
    );
});

export default OptionListRow;
