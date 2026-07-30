import React from 'react';
// @ts-ignore
import MiddleEllipsis from "react-middle-ellipsis";

type Props = {
    text: string;
    className?: string;
    position?: "middle" | "end";
} & React.HTMLAttributes<HTMLDivElement>;

export default React.memo<Props>((props: Props) => {
    const { text, position = "middle", className, ...rest } = props;

    if (position === "end") {
        return (
            <div className={"truncate " + className} {...rest}>
                {text}
            </div>
        );
    }
    return (
        <div className={className} {...rest}>
            <MiddleEllipsis>
                <span>
                    {text}
                </span>
            </MiddleEllipsis>
        </div>
    );
});
