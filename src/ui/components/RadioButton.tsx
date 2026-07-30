import React from 'react';

type Props = {
    checked: boolean;
    onChange: (checked: boolean) => void;
    title?: string;
};

export default React.memo<Props>((props: Props) => {
    const { checked, onChange, title } = props;

    return (
        <label className="flex flex-row items-center cursor-pointer">
            <div className="inline-flex items-center mr-1">
                <label className="flex items-center cursor-pointer relative">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => onChange(e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer transition-all appearance-none rounded-full shadow hover:shadow-md border border-slate-300 checked:bg-primary checked:border-primary"
                    />
                    <span className="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth={'1'}>
                            <circle cx="10" cy="10" r="5" fill="currentColor" />
                        </svg>
                    </span>
                </label>
            </div>

            {title}
        </label>
    );
});