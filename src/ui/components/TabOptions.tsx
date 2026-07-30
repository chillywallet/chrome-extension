import React, { useCallback } from 'react';

type Props = {
    options: string[];
    selected: string;
    onItemPress: (item: string) => void;
    titleCase?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    className?: string;
};

export default React.memo<Props>((props: Props) => {
    const { options, selected, onItemPress, className, titleCase = 'none' } = props;

    const getTitle = useCallback(
        (title: string) => {
            switch (titleCase) {
                case 'uppercase':
                    return title.toUpperCase();
                case 'lowercase':
                    return title.toLowerCase();
                case 'capitalize':
                    return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
                default:
                    return title;
            }
        },
        [titleCase],
    );

    return (
        <div
            className={
                'flex flex-row items-center gap-1 bg-slate-100 dark:bg-darker rounded-full p-1 text-sm ' +
                className
            }>
            {options.map((item, index) => (
                <div
                    key={index}
                    className={
                        'cursor-pointer flex flex-1 items-center justify-center py-1.5 rounded-full text-xs transition-colors ' +
                        (selected === item
                            ? 'bg-white dark:bg-accent/10 font-semibold text-primary dark:text-accent'
                            : 'hover:bg-white/60 hover:dark:bg-white/5 text-gray-500 dark:text-gray-400')
                    }
                    onClick={() => onItemPress(item)}>
                    {getTitle(item)}
                </div>
            ))}
        </div>
    );
});
