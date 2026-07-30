import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, MemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';

import { UNLOCK_ROUTE } from '../../../src/shared/constants/routes';
import ForgotCode from '../../../src/ui/pages/ForgotCode';

function twelveWords(lower = false) {
    const xs = Array.from({ length: 12 }, (_, i) => `word${i + 1}`);
    return lower ? xs.join(' ') : xs.map(w => w.toUpperCase()).join(' ');
}

function twentyFourWords(lower = false) {
    const xs = Array.from({ length: 24 }, (_, i) => `w${i + 1}`);
    return lower ? xs.join(' ') : xs.map(w => w.toUpperCase()).join(' ');
}

function getGrid(container: HTMLElement) {
    const title = screen.getByText('Secret Recovery Phrase');
    expect(title.parentElement).not.toBeNull();
    return title.nextElementSibling as HTMLElement;
}

function getPhraseInputs(container: HTMLElement): HTMLInputElement[] {
    const grid = getGrid(container);
    return Array.from(grid.querySelectorAll('input'));
}

function pasteOnRoot(container: HTMLElement, text: string) {
    const root = container.firstElementChild as HTMLElement;
    fireEvent.paste(root, {
        clipboardData: {
            getData: (format?: string) => (format === 'Text' ? text : ''),
        },
    });
}

function renderForgot(
    ui: React.ReactElement,
    history: MemoryHistory<unknown>,
) {
    const result = render(<Router history={history}>{ui}</Router>);
    return result;
}

describe('ForgotCode', () => {
    it('shows reset copy and starts with 12 empty fields when seedPhrase is unusable count', () => {
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const { container } = renderForgot(
            <ForgotCode seedPhrase="" onRecovered={onRecovered} />,
            history,
        );

        expect(screen.getByText('Reset Wallet')).toBeInTheDocument();
        expect(screen.getByText(/Chilly does not retain a copy/)).toBeInTheDocument();
        expect(screen.getByText(/I have a 24-word recovery phrase/)).toBeInTheDocument();
        expect(screen.queryByText(/I have a 12-word recovery phrase/)).not.toBeInTheDocument();

        expect(getPhraseInputs(container)).toHaveLength(12);
    });

    it('prefills 12-word phrase from seedPhrase prop (useEffect)', () => {
        const phrase = twelveWords(true);
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const { container } = renderForgot(
            <ForgotCode seedPhrase={phrase} onRecovered={onRecovered} />,
            history,
        );

        const inputs = getPhraseInputs(container);
        expect(inputs).toHaveLength(12);
        phrase.split(' ').forEach((w, i) => {
            expect(inputs[i]).toHaveValue(w);
        });
    });

    it('prefills 24-word phrase and shows 24 grid', () => {
        const phrase = twentyFourWords(true);
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const { container } = renderForgot(
            <ForgotCode seedPhrase={phrase} onRecovered={onRecovered} />,
            history,
        );

        expect(getPhraseInputs(container)).toHaveLength(24);
        expect(screen.getByText(/I have a 12-word recovery phrase/)).toBeInTheDocument();
    });

    it('back navigates to unlock via history.replace', async () => {
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const replaceSpy = jest.spyOn(history, 'replace');

        renderForgot(<ForgotCode seedPhrase="" onRecovered={onRecovered} />, history);

        await userEvent.click(screen.getByRole('button', { name: /go back/i }));
        expect(replaceSpy).toHaveBeenCalledWith(UNLOCK_ROUTE);
    });

    it('switches between 12 and 24 word modes', async () => {
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const { container } = renderForgot(
            <ForgotCode seedPhrase="" onRecovered={onRecovered} />,
            history,
        );

        expect(getPhraseInputs(container)).toHaveLength(12);

        await userEvent.click(screen.getByText(/I have a 24-word recovery phrase/));
        expect(getPhraseInputs(container)).toHaveLength(24);

        await userEvent.click(screen.getByText(/I have a 12-word recovery phrase/));
        expect(getPhraseInputs(container)).toHaveLength(12);
    });

    it('normalizes manual input to trimmed lowercase', async () => {
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const { container } = renderForgot(
            <ForgotCode seedPhrase="" onRecovered={onRecovered} />,
            history,
        );

        const inputs = getPhraseInputs(container);
        await userEvent.type(inputs[0], '  AbC  ');
        expect(inputs[0]).toHaveValue('abc');
    });

    it('toggles visibility for a word field', async () => {
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const { container } = renderForgot(
            <ForgotCode seedPhrase="" onRecovered={onRecovered} />,
            history,
        );

        const grid = getGrid(container);
        const firstInput = getPhraseInputs(container)[0];
        expect(firstInput).toHaveAttribute('type', 'password');

        const toggle = within(grid).getAllByRole('button')[0];
        await userEvent.click(toggle);
        expect(firstInput).toHaveAttribute('type', 'text');

        await userEvent.click(toggle);
        expect(firstInput).toHaveAttribute('type', 'password');
    });

    it('keeps Continue disabled until all words are filled, then calls onRecovered', async () => {
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const { container } = renderForgot(
            <ForgotCode seedPhrase="" onRecovered={onRecovered} />,
            history,
        );

        const continueBtn = screen.getByRole('button', { name: /^continue$/i });
        expect(continueBtn).toBeDisabled();

        const inputs = getPhraseInputs(container);
        for (let i = 0; i < inputs.length; i++) {
            await userEvent.type(inputs[i], `t${i}`);
        }
        expect(continueBtn).not.toBeDisabled();

        await userEvent.click(continueBtn);
        expect(onRecovered).toHaveBeenCalledTimes(1);
        expect(onRecovered).toHaveBeenCalledWith(Array.from({ length: 12 }, (_, i) => `t${i}`).join(' '));
    });

    it('paste of 12 words fills grid, lowercases, and switches to 12 mode', async () => {
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const { container } = renderForgot(
            <ForgotCode seedPhrase="" onRecovered={onRecovered} />,
            history,
        );

        await userEvent.click(screen.getByText(/I have a 24-word recovery phrase/));
        expect(getPhraseInputs(container)).toHaveLength(24);

        pasteOnRoot(container, `  ${twelveWords()}  `);
        const inputs = getPhraseInputs(container);
        expect(inputs).toHaveLength(12);
        twelveWords(true)
            .split(' ')
            .forEach((w, i) => {
                expect(inputs[i]).toHaveValue(w);
            });
    });

    it('paste of 24 words fills 24-word grid', () => {
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const { container } = renderForgot(
            <ForgotCode seedPhrase="" onRecovered={onRecovered} />,
            history,
        );

        pasteOnRoot(container, twentyFourWords());
        const inputs = getPhraseInputs(container);
        expect(inputs).toHaveLength(24);
        twentyFourWords(true)
            .split(' ')
            .forEach((w, i) => {
                expect(inputs[i]).toHaveValue(w);
            });
    });

    it('paste of invalid word count does not repopulate fields', async () => {
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const { container } = renderForgot(
            <ForgotCode seedPhrase="" onRecovered={onRecovered} />,
            history,
        );

        const inputs = getPhraseInputs(container);
        await userEvent.type(inputs[0], 'onlyone');
        pasteOnRoot(container, 'one two three');

        expect(getPhraseInputs(container)[0]).toHaveValue('onlyone');
        expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
    });

    it('normalizes and toggles visibility in 24-word mode', async () => {
        const onRecovered = jest.fn();
        const history = createMemoryHistory({ initialEntries: ['/forgot'] });
        const { container } = renderForgot(
            <ForgotCode seedPhrase="" onRecovered={onRecovered} />,
            history,
        );

        await userEvent.click(screen.getByText(/I have a 24-word recovery phrase/));
        const grid = getGrid(container);
        const inputs = getPhraseInputs(container);
        expect(inputs[0]).toHaveAttribute('type', 'password');

        await userEvent.type(inputs[0], '  XyZ  ');
        expect(inputs[0]).toHaveValue('xyz');

        const toggle = within(grid).getAllByRole('button')[0];
        await userEvent.click(toggle);
        expect(inputs[0]).toHaveAttribute('type', 'text');
        await userEvent.click(toggle);
        expect(inputs[0]).toHaveAttribute('type', 'password');
    });
});
