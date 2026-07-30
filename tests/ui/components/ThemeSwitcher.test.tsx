import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ThemeSwitcher from '../../../src/ui/components/ThemeSwitcher';

jest.mock('../../../src/store/actions/uiActions', () => ({
    setPreferColorScheme: (s: string) => ({ type: 'SET_THEME', payload: s }),
}));

let mockPreferences = { darkMode: false, darkModeSystem: false };
let mockActualTheme: 'dark' | 'light' = 'light';

jest.mock('../../../src/store/selectors', () => ({
    usePreferences: () => mockPreferences,
    useActualTheme: () => mockActualTheme,
}));

const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/ui/components/ThemeModal', () => ({
    __esModule: true,
    default: ({ show, onClose }: { show: boolean; onClose: () => void }) =>
        show ? (
            <div data-testid="theme-modal">
                <button onClick={onClose}>close-modal</button>
            </div>
        ) : null,
}));

describe('ThemeSwitcher', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPreferences = { darkMode: false, darkModeSystem: false };
        mockActualTheme = 'light';
        (window as any).matchMedia = jest.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            addListener: jest.fn(),
            removeListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));
    });

    it('renders a toggle label that is hidden on small screens', () => {
        const { container } = render(<ThemeSwitcher className="my-cls" />);
        expect(container.querySelector('.hidden.sm\\:block')).toBeInTheDocument();
    });

    it('opens the ThemeModal on label click', () => {
        const { container } = render(<ThemeSwitcher />);
        fireEvent.click(container.querySelector('label')!);
        expect(screen.getByTestId('theme-modal')).toBeInTheDocument();
    });

    it('closes the modal via onClose handler', () => {
        const { container } = render(<ThemeSwitcher />);
        fireEvent.click(container.querySelector('label')!);
        fireEvent.click(screen.getByText('close-modal'));
        expect(screen.queryByTestId('theme-modal')).toBeNull();
    });

    it('adds the dark class to documentElement when actual theme is dark', () => {
        mockActualTheme = 'dark';
        render(<ThemeSwitcher />);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes the dark class when actual theme is light', () => {
        document.documentElement.classList.add('dark');
        mockActualTheme = 'light';
        render(<ThemeSwitcher />);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('dispatches dark theme on matchMedia change to dark', () => {
        const listeners: Record<string, ((e: MediaQueryListEvent) => void)[]> = {
            dark: [],
            light: [],
        };
        (window as any).matchMedia = jest.fn((query: string) => {
            const key = query.includes('dark') ? 'dark' : 'light';
            return {
                matches: false,
                media: query,
                onchange: null,
                addEventListener: (_evt: string, cb: (e: MediaQueryListEvent) => void) => {
                    listeners[key].push(cb);
                },
                removeEventListener: jest.fn(),
                addListener: jest.fn(),
                removeListener: jest.fn(),
                dispatchEvent: jest.fn(),
            };
        });
        render(<ThemeSwitcher />);
        // Fire the dark-mode change listener with matches=true -> covers lines 22-23.
        listeners.dark.forEach(cb => cb({ matches: true } as MediaQueryListEvent));
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_THEME', payload: 'dark' });

        // Fire the light-mode change listener with matches=true -> covers lines 27-28.
        listeners.light.forEach(cb => cb({ matches: true } as MediaQueryListEvent));
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_THEME', payload: 'light' });
    });

    it('does not dispatch when matchMedia change reports matches=false', () => {
        const listeners: Record<string, ((e: MediaQueryListEvent) => void)[]> = {
            dark: [],
            light: [],
        };
        (window as any).matchMedia = jest.fn((query: string) => {
            const key = query.includes('dark') ? 'dark' : 'light';
            return {
                matches: false,
                media: query,
                onchange: null,
                addEventListener: (_evt: string, cb: (e: MediaQueryListEvent) => void) => {
                    listeners[key].push(cb);
                },
                removeEventListener: jest.fn(),
                addListener: jest.fn(),
                removeListener: jest.fn(),
                dispatchEvent: jest.fn(),
            };
        });
        render(<ThemeSwitcher />);
        listeners.dark.forEach(cb => cb({ matches: false } as MediaQueryListEvent));
        listeners.light.forEach(cb => cb({ matches: false } as MediaQueryListEvent));
        expect(mockDispatch).not.toHaveBeenCalled();
    });
});
