import React from 'react';
import { act, render, screen } from '@testing-library/react';
import Wrapper from '../../../src/ui/components/Wrapper';

let mockPath = '/home';
jest.mock('react-router-dom', () => ({
    useLocation: () => ({ pathname: mockPath }),
}));

jest.mock('../../../src/shared/constants/routes', () => ({
    ONBOARDING_CREATE_WALLET_DONE_ROUTE: '/onboarding/done',
}));

jest.mock('../../../src/shared/utils/Images', () => ({
    Images: {
        logoWalletWhite: 'logo-white.png',
        logoWalletWhiteNoText: 'logo-white-notxt.png',
        logoWalletColor: 'logo-color.png',
    },
}));

jest.mock('react-hot-toast', () => ({
    Toaster: () => <div data-testid="toaster" />,
}));

jest.mock('react-tooltip', () => ({
    Tooltip: ({ id }: { id: string }) => <div data-testid={`tooltip-${id}`} />,
}));

jest.mock('../../../src/ui/components/ContextMenuHandler', () => ({
    __esModule: true,
    default: () => <div data-testid="ctx-handler" />,
}));


jest.mock('../../../src/ui/components/ThemeSwitcher', () => ({
    __esModule: true,
    default: ({ className }: { className?: string }) => (
        <div data-testid="theme-switcher" data-cls={className ?? ''} />
    ),
}));

const setWindowDimensions = (width: number, height = 800) => {
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        writable: true,
        value: height,
    });
};

describe('Wrapper', () => {
    beforeEach(() => {
        mockPath = '/home';
    });

    it('renders the authenticated layout for /home path', () => {
        render(
            <Wrapper>
                <div>auth-child</div>
            </Wrapper>,
        );
        expect(screen.getByText('auth-child')).toBeInTheDocument();
        expect(screen.getByTestId('ctx-handler')).toBeInTheDocument();
    });

    it('renders the onboarding layout when path starts with /onboarding', () => {
        mockPath = '/onboarding/welcome';
        render(
            <Wrapper>
                <div>onb-child</div>
            </Wrapper>,
        );
        expect(screen.getByText('onb-child')).toBeInTheDocument();
    });

    it('renders pin extension message on onboarding done path', () => {
        mockPath = '/onboarding/done';
        render(
            <Wrapper>
                <div>x</div>
            </Wrapper>,
        );
        expect(screen.getByText('Pin the Chilly Extension')).toBeInTheDocument();
    });

    it('renders desktop layout for forgot-code paths', () => {
        mockPath = '/forgot-code/start';
        render(
            <Wrapper>
                <div>fc-child</div>
            </Wrapper>,
        );
        expect(screen.getByText('fc-child')).toBeInTheDocument();
        expect(screen.getAllByTestId('theme-switcher').length).toBeGreaterThan(0);
    });

    it('renders onboarding layout for /add-wallet path', () => {
        mockPath = '/add-wallet/start';
        render(
            <Wrapper>
                <div>aw-child</div>
            </Wrapper>,
        );
        expect(screen.getByText('aw-child')).toBeInTheDocument();
    });

    it('uses the no-text logo on onboarding for narrow viewports', () => {
        mockPath = '/onboarding/welcome';
        setWindowDimensions(500);
        render(
            <Wrapper>
                <div>x</div>
            </Wrapper>,
        );
        const logos = document.querySelectorAll('img[alt="Logo"]');
        expect(logos[0].getAttribute('src')).toBe('logo-white-notxt.png');
    });

    it('uses the no-text logo on the authenticated layout for narrow viewports', () => {
        mockPath = '/home';
        setWindowDimensions(500);
        render(
            <Wrapper>
                <div>x</div>
            </Wrapper>,
        );
        const logos = document.querySelectorAll('img[alt="Logo"]');
        expect(logos[0].getAttribute('src')).toBe('logo-white-notxt.png');
    });

    it('uses the text logo on the authenticated layout in the 820-1023 range', () => {
        mockPath = '/home';
        setWindowDimensions(900);
        render(
            <Wrapper>
                <div>x</div>
            </Wrapper>,
        );
        const logos = document.querySelectorAll('img[alt="Logo"]');
        expect(logos[0].getAttribute('src')).toBe('logo-white.png');
    });

    it('uses the no-text logo on the authenticated layout in the 1024-1169 range', () => {
        mockPath = '/home';
        setWindowDimensions(1100);
        render(
            <Wrapper>
                <div>x</div>
            </Wrapper>,
        );
        const logos = document.querySelectorAll('img[alt="Logo"]');
        expect(logos[0].getAttribute('src')).toBe('logo-white-notxt.png');
    });

    it('uses the text logo on the authenticated layout for wide viewports', () => {
        mockPath = '/home';
        setWindowDimensions(1400);
        render(
            <Wrapper>
                <div>x</div>
            </Wrapper>,
        );
        const logos = document.querySelectorAll('img[alt="Logo"]');
        expect(logos[0].getAttribute('src')).toBe('logo-white.png');
    });

    it('refreshes the window size when the resize event fires', () => {
        mockPath = '/home';
        setWindowDimensions(1400);
        render(
            <Wrapper>
                <div>x</div>
            </Wrapper>,
        );
        // Initially uses the text logo.
        let logos = document.querySelectorAll('img[alt="Logo"]');
        expect(logos[0].getAttribute('src')).toBe('logo-white.png');

        act(() => {
            setWindowDimensions(500);
            window.dispatchEvent(new Event('resize'));
        });

        logos = document.querySelectorAll('img[alt="Logo"]');
        expect(logos[0].getAttribute('src')).toBe('logo-white-notxt.png');
    });
});
