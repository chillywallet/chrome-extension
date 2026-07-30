import React, { useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

type Props = {
    title: string;
    className?: string;
    defaultExpanded?: boolean;
    children: React.ReactNode;
};

export default React.memo<Props>((props: Props) => {
    const { title, defaultExpanded, className, children } = props;

    const [expanded, setExpanded] = useState(defaultExpanded ? defaultExpanded : false);

    return (
        <div className={"rounded-lg shadow-lg overflow-hidden dark:bg-dark " + className}>
            <div className="flex flex-row items-center cursor-pointer text-sm px-5 py-2" onClick={() => {
                setExpanded(!expanded);
            }}>
                <div className="flex-1">{title}</div>

                {expanded ? (
                    <FaChevronUp />
                ) : (
                    <FaChevronDown />
                )}
            </div>

            <div className={`px-5 py-2 border-t text-sm dark:border-gray-800 transition-all duration-500 ${expanded ? 'opacity-100' : 'opacity-0'} ${expanded ? 'block' : 'hidden'}`}>
                {children}
            </div>
        </div>
    );
});