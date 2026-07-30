import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { ANIM_DURATION } from '../../shared/constants/app';

type Props = {
    visible: boolean;
    children: React.ReactNode;
    onClose: () => void;
    /** @default true */
    closeOnBackdropClick?: boolean;
};

export default React.memo<Props>((props: Props) => {
    const { visible, children, onClose, closeOnBackdropClick = true } = props;

    return visible ? (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 flex items-end sm:items-center justify-center z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: ANIM_DURATION }}>
                <div
                    className="fixed inset-0 sheet-overlay"
                    onClick={closeOnBackdropClick ? onClose : undefined}
                />
                <motion.div
                    className="sheet w-full sm:w-[400px] sm:rounded-2xl sm:border shadow-xl z-10 overflow-hidden flex flex-col max-h-[85vh]"
                    initial={{ y: 24 }}
                    animate={{ y: 0 }}
                    exit={{ y: 24 }}
                    transition={{ duration: ANIM_DURATION }}>
                    <div className="sheet-handle sm:hidden" aria-hidden="true" />
                    <div className="flex flex-col overflow-y-auto">{children}</div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    ) : null;
});
