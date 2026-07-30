import React from 'react';
import { render, screen } from '@testing-library/react';
import AssetLogo from '../../../src/ui/components/AssetLogo';

jest.mock('../../../src/ui/components/NetworkIcon', () => ({
    __esModule: true,
    default: (props: any) => (
        <div
            data-testid="network-icon"
            data-name={props.network?.short_name ?? ''}
            data-size={props.size}
        />
    ),
}));

jest.mock('../../../src/ui/components/SafeImage', () => ({
    __esModule: true,
    default: ({ src, fallback, alt }: { src?: string | null; fallback?: string; alt: string }) => (
        <img data-testid="safe-image" data-src={src ?? ''} data-fallback={fallback ?? ''} alt={alt} />
    ),
}));

jest.mock('../../../src/lib/ChainsUtils', () => ({
    __esModule: true,
    getCurrentChainByPlatformId: (id: number) => {
        if (id === 0) throw new Error('unknown chain');
        return { short_name: `chain-${id}` };
    },
}));

describe('AssetLogo', () => {
    it('renders SafeImage with provided src', () => {
        render(<AssetLogo src="http://x.png" width={40} />);
        expect(screen.getByTestId('safe-image')).toHaveAttribute('data-src', 'http://x.png');
    });

    it('renders without a platform icon when platform_id is not set', () => {
        render(<AssetLogo width={40} />);
        expect(screen.queryByTestId('network-icon')).toBeNull();
    });

    it('renders the NetworkIcon when a platform_id is supplied', () => {
        render(<AssetLogo width={40} platform_id={1} />);
        const icon = screen.getByTestId('network-icon');
        expect(icon).toHaveAttribute('data-name', 'chain-1');
        expect(icon).toHaveAttribute('data-size', '16');
    });

    it('silently swallows errors thrown by chain lookup', () => {
        render(<AssetLogo width={40} platform_id={0} />);
        expect(screen.queryByTestId('network-icon')).toBeNull();
    });
});
