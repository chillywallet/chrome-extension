import React, { useMemo } from 'react';
import { getCurrentChainByPlatformId } from '../../lib/ChainsUtils';
import { Images } from '../../shared/utils/Images';
import NetworkIcon from './NetworkIcon';
import SafeImage from './SafeImage';

type LogoProps = {
    src?: string;
    className?: string;
    platform_id?: number;
    width: number;
};

export default React.memo<LogoProps>((props: LogoProps) => {
    const { src, className, width, platform_id } = props;

    const platformIcon = useMemo(() => {
        if (platform_id) {
            try {
                const _network = getCurrentChainByPlatformId(platform_id);
                const _width = width * 0.4;

                return (
                    <NetworkIcon
                        network={_network}
                        size={_width}
                        className="absolute bottom-0 right-0 bg-[#F1F4FA] border-[1px]"
                    />
                );
            } catch (error) {}
        }
        return null;
    }, [platform_id, width]);

    return (
        <div className={'relative ' + className}>
            <div className={`overflow-hidden rounded-full bg-[#F1F4FA] shrink-0`}>
                <SafeImage
                    src={src ?? null}
                    alt="Asset Logo"
                    style={{ width, height: width }}
                    fallback={Images.iconQuestion}
                />
            </div>
            {platformIcon}
        </div>
    );
});
