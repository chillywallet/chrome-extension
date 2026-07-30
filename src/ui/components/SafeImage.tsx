import React, { CSSProperties, useCallback, useEffect, useState } from 'react';
import { FaCompass } from 'react-icons/fa';

type Props = {
    src: string | null;
    alt: string;
    className?: string;
    style?: CSSProperties;
    fallback?: string;
    defaultPlaceholder?: React.ReactNode;
};

export default React.memo<Props>((props: Props) => {
    const { src, alt, className, fallback, style, defaultPlaceholder, ...rest } = props;

    const [showPlaceholder, setShowPlaceholder] = useState<boolean>(!src);
    const [currentSrc, setCurrentSrc] = useState<string | null>(src);

    const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        setShowPlaceholder(true);
    }, []);

    useEffect(() => {
        if (src !== currentSrc) {
            setShowPlaceholder(!src); // Show placeholder only if the new `src` is invalid
            setCurrentSrc(src); // Update the currentSrc state to match the new src
        }
    }, [src, currentSrc]);

    if (showPlaceholder) {
        if (fallback) {
            return <img src={fallback} alt={alt} style={style} className={className} {...rest} />;
        }

        if (defaultPlaceholder) {
            return <>{defaultPlaceholder}</>;
        }

        return (
            <div
                style={style}
                className={
                    className +
                    ' bg-primary bg-opacity-10 flex justify-center items-center rounded-full'
                }>
                <FaCompass className="text-white text-2xl" />
            </div>
        );
    }
    return (
        <img
            src={src ?? ''}
            alt={alt}
            style={style}
            className={className}
            loading="lazy"
            onError={handleError}
            {...rest}
        />
    );
});
