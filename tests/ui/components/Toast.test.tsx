import React from 'react';
import { render } from '@testing-library/react';
import toast from 'react-hot-toast';
import Toast from '../../../src/ui/components/Toast';

jest.mock('react-hot-toast', () => {
    const fn: any = jest.fn();
    fn.dismiss = jest.fn();
    return { __esModule: true, default: fn };
});

const mockToast = toast as unknown as jest.Mock & { dismiss: jest.Mock };

describe('Toast', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('invokes toast with the success message in a render-prop', () => {
        Toast.showSuccess('Saved!');
        expect(mockToast).toHaveBeenCalledTimes(1);
        const [renderFn, options] = mockToast.mock.calls[0];
        const { container } = render(renderFn({ id: 't-1' }));
        expect(container.textContent).toContain('Saved!');
        expect(options.duration).toBe(4000);
    });

    it('invokes toast with the error message and applies error styling options', () => {
        Toast.showError('Bad!');
        const [renderFn, options] = mockToast.mock.calls[0];
        const { container } = render(renderFn({ id: 't-err' }));
        expect(container.textContent).toContain('Bad!');
        expect(options.style.background).toContain('#ef4444');
    });

    it('success close button dismisses the toast', () => {
        Toast.showSuccess('Hello');
        const [renderFn] = mockToast.mock.calls[0];
        const { container } = render(renderFn({ id: 't-2' }));
        container.querySelector('button')?.click();
        expect((mockToast as any).dismiss).toHaveBeenCalledWith('t-2');
    });

    it('error close button dismisses the toast', () => {
        Toast.showError('Hello');
        const [renderFn] = mockToast.mock.calls[0];
        const { container } = render(renderFn({ id: 't-3' }));
        container.querySelector('button')?.click();
        expect((mockToast as any).dismiss).toHaveBeenCalledWith('t-3');
    });
});
