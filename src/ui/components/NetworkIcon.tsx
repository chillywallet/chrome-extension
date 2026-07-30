/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import { ChainData } from '../../shared/types/Chain';

type Props = {
    network?: ChainData;
    className?: string;
    size?: number;
};

export default React.memo<Props>((props: Props) => {
    const { network, className, size = 17 } = props;

    return network?.icon ? (
        <img
            src={network.icon}
            className={"rounded-full " + className}
            style={{
                width: size,
                height: size,
            }}
        />
    ) : null;
});
