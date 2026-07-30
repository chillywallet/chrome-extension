import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaArrowDown } from "react-icons/fa";

type Props = {
    children: React.ReactNode;
    className?: string;
};

export default React.memo((props: Props) => {
    const { children, className } = props;
    const [isScrollable, setIsScrollable] = useState<boolean>(false);
    const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
    const contentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (contentRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
                setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 10); // Check if near the bottom
            }
        };

        const checkScrollable = () => {
            if (contentRef.current) {
                const { scrollHeight, clientHeight } = contentRef.current;
                setIsScrollable(scrollHeight > clientHeight);
            }
        };

        const observeChildrenChanges = () => {
            if (contentRef.current) {
                const observer = new MutationObserver(() => {
                    // Recheck if the content height changes
                    checkScrollable();
                });

                observer.observe(contentRef.current, {
                    childList: true, // Observe direct children changes
                    subtree: true, // Observe nested changes
                });

                return () => {
                    // Cleanup when component unmounts
                    observer.disconnect();
                };
            }
        };

        checkScrollable(); // Initial check
        const contentEl = contentRef.current;

        contentEl?.addEventListener("scroll", handleScroll);
        const mutationObserverCleanup = observeChildrenChanges();

        window.addEventListener("resize", checkScrollable);

        return () => {
            contentEl?.removeEventListener("scroll", handleScroll);
            mutationObserverCleanup?.();
            window.removeEventListener("resize", checkScrollable);
        };
    }, []);

    const handleScrollButtonClick = () => {
        if (contentRef.current) {
            contentRef.current.scrollTo({
                top: contentRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    };

    const visible = useMemo(() => {
        return isScrollable && !isAtBottom;
    }, [isScrollable, isAtBottom]);

    return (
        <div className={`relative ${className} !p-0 !m-0`}>
            <div ref={contentRef} className={`${className} overflow-y-auto`}>
                {children}
            </div>

            <div
                onClick={handleScrollButtonClick}
                className={`absolute cursor-pointer flex items-center justify-center bottom-4 left-1/2 transform -translate-x-1/2 overflow-hidden !border-[1px] !border-primary dark:!border-white bg-white dark:bg-darker text-primary dark:text-white h-7 w-7 rounded-full shadow-md transition-all duration-300 ${!visible ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}>
                <FaArrowDown className="text-xs" />
            </div>
        </div>
    );
});