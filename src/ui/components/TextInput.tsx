import { forwardRef, InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    className?: string;
    inputClassName?: string;
    label?: string;
}

export default forwardRef<HTMLInputElement, TextInputProps>((props, ref) => {
    const { className, inputClassName, label, ...inputProps } = props;

    return (
        <div
            className={
                'w-full border border-slate-200 dark:border-darkline rounded-xl px-3 py-1 bg-slate-50 dark:bg-white/5 focus-within:border-primary dark:focus-within:border-accent transition-colors ' +
                className
            }>
            <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
            <input
                ref={ref}
                {...inputProps}
                className={'w-full border-none focus:outline-none bg-transparent ' + inputClassName}
            />
        </div>
    );
});
