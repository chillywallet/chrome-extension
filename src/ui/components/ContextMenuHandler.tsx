import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useMemo, useState } from 'react';
import { ANIM_DURATION } from '../../shared/constants/app';
import EventType from '../../shared/types/EventType';
import eventManager from '../../shared/utils/eventManager';

type Props = {};

const MENU_ITEM_HEIGHT = 40;

export default React.memo<Props>(() => {
    const [contextMenuCoordinate, setContextMenuCoordinate] = useState<DOMRect | null>(null);
    const [visible, setVisible] = useState<boolean>(false);
    const [menus, setMenus] = useState<React.ReactNode[]>([]);

    const menuLength = useMemo(() => {
        return menus.length
    }, [menus]);

    const menuHeight = useMemo(() => {
        return menuLength * MENU_ITEM_HEIGHT;
    }, [menuLength]);

    useEffect(() => {
        eventManager.on(
            EventType.SET_CONTEXT_MENU_COORDINATE,
            (data: { coordinate: DOMRect; menus: any }) => {
                setContextMenuCoordinate(data.coordinate);
                setVisible(true);
                // Normalize menus to always be an array
                const menusArray = Array.isArray(data.menus) ? data.menus : [data.menus];
                setMenus(menusArray);
            },
        );

        // Hide menu on resize
        const handleResize = () => setVisible(false);
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Determine if there is enough space below, otherwise place the menu on top
    const hasEnoughSpaceBelow = useMemo(() => {
        return (contextMenuCoordinate?.bottom ?? 0) + menuHeight <= window.innerHeight;
    }, [contextMenuCoordinate, menuHeight]);

    if (!visible || !contextMenuCoordinate) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed w-screen h-screen top-0 left-0 z-[60]"
                id="context-menu"
                onClick={e => {
                    e.stopPropagation();
                    setVisible(false);
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: ANIM_DURATION }}>
                <div
                    className="absolute text-sm z-[60] text-black dark:text-white bg-white dark:bg-header rounded-xl border border-slate-200 dark:border-darkline/60 shadow-xl min-w-40 overflow-hidden p-1"
                    style={{
                        right: `${window.innerWidth -
                            ((contextMenuCoordinate?.left ?? 0) +
                                (contextMenuCoordinate?.width ?? 0))
                            }px`,
                        top: hasEnoughSpaceBelow
                            ? `${contextMenuCoordinate.bottom}px` // bottom-left
                            : `${contextMenuCoordinate.top - menuHeight}px`, // top-left
                    }}>
                    {menus}
                </div>
            </motion.div>
        </AnimatePresence>
    );
});