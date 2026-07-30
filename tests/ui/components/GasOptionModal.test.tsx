import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GasOptionModal from '../../../src/ui/components/GasOptionModal';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children, onClose }: any) =>
        visible ? (
            <div data-testid="modal">
                <button data-testid="modal-onclose" onClick={onClose}>
                    modal-close
                </button>
                {children}
            </div>
        ) : null,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, onClosePress }: any) => (
        <div>
            <span>{title}</span>
            <button onClick={onClosePress}>header-close</button>
        </div>
    ),
}));

jest.mock('../../../src/ui/components/GasOptionContent', () => ({
    __esModule: true,
    default: () => <div data-testid="gas-option-content" />,
}));

jest.mock('../../../src/shared/types/Wallet', () => ({
    GasType: { Custom: 'custom', High: 'high' },
}));

describe('GasOptionModal', () => {
    it('renders title and gas option content', () => {
        render(<GasOptionModal visible={true} onClosePress={jest.fn()} />);
        expect(screen.getByText('Edit Network Fee')).toBeInTheDocument();
        expect(screen.getByTestId('gas-option-content')).toBeInTheDocument();
    });

    it('does not render when invisible', () => {
        render(<GasOptionModal visible={false} onClosePress={jest.fn()} />);
        expect(screen.queryByText('Edit Network Fee')).toBeNull();
    });

    it('invokes onClosePress when the Modal onClose handler is triggered', () => {
        const onClosePress = jest.fn();
        render(<GasOptionModal visible={true} onClosePress={onClosePress} />);
        fireEvent.click(screen.getByTestId('modal-onclose'));
        expect(onClosePress).toHaveBeenCalled();
    });

    it('invokes onClosePress via the Header close button', () => {
        const onClosePress = jest.fn();
        render(<GasOptionModal visible={true} onClosePress={onClosePress} />);
        fireEvent.click(screen.getByText('header-close'));
        expect(onClosePress).toHaveBeenCalled();
    });
});
