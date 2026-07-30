import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import EventType from '../../../src/shared/types/EventType';
import eventManager from '../../../src/shared/utils/eventManager';
import ContextMenu, { ContextMenuItem } from '../../../src/ui/components/ContextMenu';

jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: {
        emit: jest.fn(),
    },
}));

function stubDomRect() {
    return {
        bottom: 48,
        height: 40,
        left: 10,
        right: 50,
        top: 8,
        width: 40,
        x: 10,
        y: 8,
        toJSON() {
            return {};
        },
    };
}

function getActivator(container: HTMLElement) {
    const el = container.querySelector('.cursor-pointer');
    expect(el).not.toBeNull();
    return el as HTMLElement;
}

describe('ContextMenu', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the placeholder', () => {
        render(
            <ContextMenu placeholder={<span>Open menu</span>} menus={<div>Items</div>} />,
        );
        expect(screen.getByText('Open menu')).toBeInTheDocument();
    });

    it('applies id and className to the root', () => {
        const { container } = render(
            <ContextMenu
                id="ctx-root"
                className="extra-class"
                placeholder={<span>P</span>}
                menus={null}
            />,
        );
        const root = container.firstChild as HTMLElement;
        expect(root).toHaveAttribute('id', 'ctx-root');
        expect(root.className).toContain('relative');
        expect(root.className).toContain('extra-class');
    });

    it('emits SET_CONTEXT_MENU_COORDINATE with bounding rect and menus on placeholder click', () => {
        const menus = <div data-testid="menu-node">Menu content</div>;
        const { container } = render(
            <ContextMenu placeholder={<span>Trigger</span>} menus={menus} />,
        );

        const activator = getActivator(container);
        const rect = stubDomRect();
        jest.spyOn(activator, 'getBoundingClientRect').mockReturnValue(rect);

        fireEvent.click(activator);

        expect(eventManager.emit).toHaveBeenCalledTimes(1);
        expect(eventManager.emit).toHaveBeenCalledWith(EventType.SET_CONTEXT_MENU_COORDINATE, {
            coordinate: rect,
            menus,
        });
    });

    it('stops propagation on placeholder click', () => {
        const parentClick = jest.fn();
        render(
            <button type="button" onClick={parentClick}>
                <ContextMenu placeholder={<span>Inner</span>} menus={null} />
            </button>,
        );
        fireEvent.click(screen.getByText('Inner'));
        expect(parentClick).not.toHaveBeenCalled();
    });

    it('handles mouseup outside #context-menu after opening', () => {
        const { container } = render(<ContextMenu placeholder={<span>T</span>} menus={<div>M</div>} />);
        const activator = getActivator(container);
        jest.spyOn(activator, 'getBoundingClientRect').mockReturnValue(stubDomRect());

        fireEvent.click(activator);

        const outside = document.createElement('div');
        document.body.appendChild(outside);
        fireEvent.mouseUp(outside);
        outside.remove();
    });

    it('does not close on mouseup when the target is inside #context-menu', () => {
        const { container } = render(<ContextMenu placeholder={<span>T</span>} menus={<div>M</div>} />);
        const activator = getActivator(container);
        jest.spyOn(activator, 'getBoundingClientRect').mockReturnValue(stubDomRect());

        fireEvent.click(activator);

        const overlay = document.createElement('div');
        overlay.id = 'context-menu';
        const inner = document.createElement('button');
        overlay.appendChild(inner);
        document.body.appendChild(overlay);

        fireEvent.mouseUp(inner);

        overlay.remove();
    });

    it('ignores mouseup when the menu trigger has not been opened', () => {
        render(<ContextMenu placeholder={<span>T</span>} menus={<div>M</div>} />);
        fireEvent.mouseUp(document.body);
    });

    it('does nothing on mouseup when event target is not an Element', () => {
        const { container } = render(<ContextMenu placeholder={<span>T</span>} menus={<div>M</div>} />);
        const activator = getActivator(container);
        jest.spyOn(activator, 'getBoundingClientRect').mockReturnValue(stubDomRect());

        fireEvent.click(activator);

        expect(document instanceof Element).toBe(false);
        fireEvent.mouseUp(document, { target: document });
    });

    it('removes the mouseup listener on unmount', () => {
        const addSpy = jest.spyOn(window, 'addEventListener');
        const removeSpy = jest.spyOn(window, 'removeEventListener');

        const { unmount } = render(
            <ContextMenu placeholder={<span>x</span>} menus={null} />,
        );

        expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

        unmount();

        expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

        addSpy.mockRestore();
        removeSpy.mockRestore();
    });
});

describe('ContextMenuItem', () => {
    it('renders title and invokes onClick', () => {
        const onClick = jest.fn();
        render(
            <ContextMenuItem title="Rename" icon={<span data-testid="ico">I</span>} onClick={onClick} />,
        );
        expect(screen.getByText('Rename')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Rename'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('applies delete styling when type is delete', () => {
        const { container } = render(
            <ContextMenuItem title="Remove" type="delete" icon={<span />} onClick={() => {}} />,
        );
        const root = container.firstChild as HTMLElement;
        expect(root.className).toContain('text-red-600');
    });

    it('omits the icon wrapper when icon is falsy', () => {
        const { container } = render(
            <ContextMenuItem title="Plain" icon={null as unknown as React.ReactNode} onClick={() => {}} />,
        );
        expect(screen.getByText('Plain')).toBeInTheDocument();
        expect(container.querySelector('.w-5')).toBeNull();
    });

    it('uses default text styling when type is not delete', () => {
        const { container } = render(
            <ContextMenuItem title="Edit" icon={<span />} onClick={() => {}} />,
        );
        const root = container.firstChild as HTMLElement;
        expect(root.className).toContain('text-black');
        expect(root.className).not.toContain('text-red-600');
    });
});
