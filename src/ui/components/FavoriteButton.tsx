import React, { useMemo } from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import { useActualTheme } from '../../store/selectors';

type Props = {
    isFavorite: boolean;
    onAdd: () => void;
    onRemove: () => void;
    className?: string;
    size?: number;
};

export default React.memo<Props>((props: Props) => {
    const { isFavorite, onAdd, onRemove, className = 'cursor-pointer w-5', size = 18 } = props;
    const theme = useActualTheme();

    const tooltipVariant = useMemo(() => {
        return theme === 'dark' ? 'light' : 'dark';
    }, [theme]);

    if (isFavorite) {
        return (
            <div
                className={className}
                data-tooltip-id="chilly-tooltip"
                data-tooltip-variant={tooltipVariant}
                data-tooltip-content="Coin is already in favorites"
                data-tooltip-place="top"
                onClick={onRemove}>
                <FaStar size={size} className="text-yellow-500" />
            </div>
        );
    }

    return (
        <div
            className={className}
            data-tooltip-id="chilly-tooltip"
            data-tooltip-variant={tooltipVariant}
            data-tooltip-content="Add to favorites"
            data-tooltip-place="top"
            onClick={onAdd}>
            <FaRegStar size={size} />
        </div>
    );
});
