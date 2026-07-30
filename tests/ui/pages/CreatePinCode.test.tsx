import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { FORGOT_CODE_CREATE_PIN_CODE_ROUTE } from '../../../src/shared/constants/routes';
import CreatePinCode from '../../../src/ui/pages/CreatePinCode';

function renderCreateCode(
    path: string,
    props: { onCreatePinCode?: (passKey: string) => void } = {},
) {
    const onCreatePinCode = props.onCreatePinCode ?? jest.fn();
    return {
        onCreatePinCode,
        ...render(
            <MemoryRouter initialEntries={[path]}>
                <CreatePinCode password="" onCreatePinCode={onCreatePinCode} />
            </MemoryRouter>,
        ),
    };
}

describe('CreatePinCode', () => {
    const originalBuildType = process.env.BUILD_TYPE;

    afterEach(() => {
        process.env.BUILD_TYPE = originalBuildType;
    });

    it('renders pin setup copy and inputs', () => {
        process.env.BUILD_TYPE = 'Prod';
        renderCreateCode('/some-route');

        expect(screen.getByText('Create Pin Code')).toBeInTheDocument();
        expect(screen.getByText('Create Your Secure Pin Code')).toBeInTheDocument();
        expect(
            screen.getByText(/For your security, please set up a unique PIN/i),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Your Pin Code')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Confirm Pin Code')).toBeInTheDocument();
    });

    it('prefills pin fields when BUILD_TYPE is Debug', () => {
        process.env.BUILD_TYPE = 'Debug';
        renderCreateCode('/some-route');

        expect(screen.getByPlaceholderText('Your Pin Code')).toHaveValue('11111111');
        expect(screen.getByPlaceholderText('Confirm Pin Code')).toHaveValue('11111111');
    });

    it('shows back button and desktop width layout on forgot-code route', () => {
        process.env.BUILD_TYPE = 'Prod';
        const { container } = renderCreateCode(FORGOT_CODE_CREATE_PIN_CODE_ROUTE);

        expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
        const root = container.firstChild as HTMLElement;
        expect(root.className).toContain('sm:w-[450px]');
    });

    it('hides back button outside forgot-code flow', () => {
        process.env.BUILD_TYPE = 'Prod';
        const { container } = renderCreateCode('/onboarding/create-pin');

        expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument();
        const root = container.firstChild as HTMLElement;
        expect(root.className).not.toContain('sm:w-[450px]');
    });

    it('shows error when pin and confirmation do not match', async () => {
        process.env.BUILD_TYPE = 'Prod';
        const { onCreatePinCode } = renderCreateCode('/route');

        await userEvent.type(screen.getByPlaceholderText('Your Pin Code'), 'abcdefgh');
        await userEvent.type(screen.getByPlaceholderText('Confirm Pin Code'), 'abcdefgi');
        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(screen.getByText('Your entries did not match')).toBeInTheDocument();
        expect(onCreatePinCode).not.toHaveBeenCalled();
    });

    it('shows error when pin is shorter than 8 characters', async () => {
        process.env.BUILD_TYPE = 'Prod';
        const { onCreatePinCode } = renderCreateCode('/route');

        await userEvent.type(screen.getByPlaceholderText('Your Pin Code'), 'short');
        await userEvent.type(screen.getByPlaceholderText('Confirm Pin Code'), 'short');
        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(screen.getByText('Code must be at least 8 characters')).toBeInTheDocument();
        expect(onCreatePinCode).not.toHaveBeenCalled();
    });

    it('calls onCreatePinCode when pins match and meet length requirement', async () => {
        process.env.BUILD_TYPE = 'Prod';
        const { onCreatePinCode } = renderCreateCode('/route');

        await userEvent.type(screen.getByPlaceholderText('Your Pin Code'), 'mysecure1');
        await userEvent.type(screen.getByPlaceholderText('Confirm Pin Code'), 'mysecure1');
        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(onCreatePinCode).toHaveBeenCalledTimes(1);
        expect(onCreatePinCode).toHaveBeenCalledWith('mysecure1');
    });

    it('moves focus from pin to confirm field on Enter in first input', () => {
        process.env.BUILD_TYPE = 'Prod';
        renderCreateCode('/route');

        const pin = screen.getByPlaceholderText('Your Pin Code');
        const confirm = screen.getByPlaceholderText('Confirm Pin Code');

        pin.focus();
        fireEvent.keyUp(pin, { key: 'Enter' });

        expect(document.activeElement).toBe(confirm);
    });

    it('submits when Enter is pressed in confirm field with valid matching pins', async () => {
        process.env.BUILD_TYPE = 'Prod';
        const { onCreatePinCode } = renderCreateCode('/route');

        await userEvent.type(screen.getByPlaceholderText('Your Pin Code'), 'validpin8');
        const confirm = screen.getByPlaceholderText('Confirm Pin Code');
        await userEvent.type(confirm, 'validpin8');
        fireEvent.keyUp(confirm, { key: 'Enter' });

        expect(onCreatePinCode).toHaveBeenCalledWith('validpin8');
    });

    it('does not throw when Enter on pin field has no next input to focus', () => {
        process.env.BUILD_TYPE = 'Prod';
        renderCreateCode('/route');

        const pin = screen.getByPlaceholderText('Your Pin Code');
        const confirmInput = screen.getByPlaceholderText('Confirm Pin Code');
        confirmInput.remove();

        pin.focus();
        expect(() => fireEvent.keyUp(pin, { key: 'Enter' })).not.toThrow();
        expect(document.activeElement).toBe(pin);
    });
});
