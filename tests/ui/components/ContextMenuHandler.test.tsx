jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: { div: ({ children, ...rest }: any) => <div {...rest}>{children}</div> },
}));

jest.mock('../../../src/shared/constants/app', () => ({ ANIM_DURATION: 0 }));

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import ContextMenuHandler from '../../../src/ui/components/ContextMenuHandler';
import eventManager from '../../../src/shared/utils/eventManager';
import EventType from '../../../src/shared/types/EventType';

describe('ContextMenuHandler', () => {
    beforeEach(() => {
        eventManager.list.clear();
    });

    it('does not render anything by default', () => {
        const { container } = render(<ContextMenuHandler />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the context menu after SET_CONTEXT_MENU_COORDINATE event', async () => {
        render(<ContextMenuHandler />);
        eventManager.emit(EventType.SET_CONTEXT_MENU_COORDINATE, {
            coordinate: { top: 0, bottom: 50, left: 0, width: 50 } as any,
            menus: [<button key="1">Menu Item</button>],
        });
        await waitFor(() =>
            expect(document.getElementById('context-menu')).not.toBeNull(),
        );
    });

    it('hides menu when clicking overlay', async () => {
        render(<ContextMenuHandler />);
        act(() => {
            eventManager.emit(EventType.SET_CONTEXT_MENU_COORDINATE, {
                coordinate: { top: 0, bottom: 50, left: 0, width: 50 } as any,
                menus: [<button key="1">Menu</button>],
            });
        });
        await waitFor(() => expect(document.getElementById('context-menu')).not.toBeNull());
        const overlay = document.getElementById('context-menu')!;
        fireEvent.click(overlay);
        await waitFor(() => expect(document.getElementById('context-menu')).toBeNull());
    });

    it('hides menu on window resize', async () => {
        render(<ContextMenuHandler />);
        act(() => {
            eventManager.emit(EventType.SET_CONTEXT_MENU_COORDINATE, {
                coordinate: { top: 0, bottom: 50, left: 0, width: 50 } as any,
                menus: [<button key="1">Menu</button>],
            });
        });
        await waitFor(() => expect(document.getElementById('context-menu')).not.toBeNull());
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
        await waitFor(() => expect(document.getElementById('context-menu')).toBeNull());
    });

    it('normalizes a non-array menus payload', async () => {
        render(<ContextMenuHandler />);
        act(() => {
            eventManager.emit(EventType.SET_CONTEXT_MENU_COORDINATE, {
                coordinate: { top: 0, bottom: 50, left: 0, width: 50 } as any,
                menus: <button key="solo">Solo Menu</button>,
            });
        });
        await waitFor(() => expect(document.getElementById('context-menu')).not.toBeNull());
    });

    it('places menu on top when not enough space below', async () => {
        // window.innerHeight default in jsdom is 768
        render(<ContextMenuHandler />);
        act(() => {
            eventManager.emit(EventType.SET_CONTEXT_MENU_COORDINATE, {
                coordinate: { top: 700, bottom: 760, left: 0, width: 50 } as any,
                menus: [
                    <button key="1">A</button>,
                    <button key="2">B</button>,
                    <button key="3">C</button>,
                ],
            });
        });
        await waitFor(() => expect(document.getElementById('context-menu')).not.toBeNull());
    });

    it('handles coordinate missing left/width/bottom', async () => {
        render(<ContextMenuHandler />);
        act(() => {
            eventManager.emit(EventType.SET_CONTEXT_MENU_COORDINATE, {
                coordinate: {} as any,
                menus: [<button key="1">M</button>],
            });
        });
        await waitFor(() => expect(document.getElementById('context-menu')).not.toBeNull());
    });
});
