import React, { useEffect, useState } from 'react';
import EventType from '../../shared/types/EventType';
import eventManager from '../../shared/utils/eventManager';

type Props = {
    id?: string;
    className?: string;
    placeholder: React.ReactNode;
    menus: React.ReactNode;
};

export const ContextMenuItem = React.memo(
    (props: {
        title: string;
        type?: 'delete';
        icon: React.ReactNode;
        onClick: (item: any) => void;
    }) => {
        const { title, icon, onClick, type } = props;
        return (
            <div
                className={
                    'flex text-left cursor-pointer items-center h-10 w-full px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors ' +
                    (type === 'delete' ? 'text-red-600' : 'text-black dark:text-white')
                }
                onClick={onClick}>
                {icon && (
                    <span
                        className={
                            'w-5 flex flex-row justify-center mr-2 text-md ' +
                            (type === 'delete' ? 'text-red-600' : 'text-primary dark:text-accent')
                        }>
                        {icon}
                    </span>
                )}
                <span className="flex-1 text-nowrap">{title}</span>
            </div>
        );
    },
);

export default React.memo<Props>((props: Props) => {
    const { id, menus, placeholder } = props;

    const [visible, setVisible] = useState<boolean>(false);

    useEffect(() => {
        //create onclick event to close the context menu
        const handleClick = (e: MouseEvent) => {
            if (visible) {
                if (e.target instanceof Element && !e.target.closest('#context-menu')) {
                    setVisible(false);
                }
            }
        };

        //add event listener to the window
        window.addEventListener('mouseup', handleClick);

        //cleanup the event listener
        return () => {
            window.removeEventListener('mouseup', handleClick);
        };
    }, [visible]);

    return (
        <div id={id} className={'relative ' + (props.className ?? '')}>
            <div
                className="cursor-pointer"
                onClick={e => {
                    e.stopPropagation();

                    setVisible(true);

                    eventManager.emit(EventType.SET_CONTEXT_MENU_COORDINATE, {
                        coordinate: e.currentTarget.getBoundingClientRect(),
                        menus,
                    });
                }}>
                {placeholder}
            </div>
        </div>
    );
});
