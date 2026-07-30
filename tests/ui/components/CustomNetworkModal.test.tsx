import React from 'react';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import CustomNetworkModal from '../../../src/ui/components/CustomNetworkModal';

jest.mock('../../../src/ui/components/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: any) =>
        visible ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('../../../src/ui/components/Header', () => ({
    __esModule: true,
    default: ({ title, onClosePress }: any) => (
        <div>
            <span>{title}</span>
            <button onClick={onClosePress}>hdr-close</button>
        </div>
    ),
}));

jest.mock('../../../src/ui/components/TextInput', () => ({
    __esModule: true,
    default: ({ value, onChange, label }: any) => (
        <input data-testid="rpc-input" aria-label={label} value={value} onChange={onChange} />
    ),
}));

const mockToastSuccess = jest.fn();
jest.mock('../../../src/ui/components/Toast', () => ({
    __esModule: true,
    default: { showSuccess: (...args: any[]) => mockToastSuccess(...args) },
}));

const mockGetNetwork = jest.fn();
const mockGetBalance = jest.fn();
jest.mock('ethers', () => ({
    JsonRpcProvider: jest.fn(),
}));
const ethersMock = require('ethers');
function restoreJsonRpcProvider() {
    (ethersMock.JsonRpcProvider as jest.Mock).mockImplementation(() => ({
        getNetwork: () => mockGetNetwork(),
        getBalance: () => mockGetBalance(),
    }));
}

const mockGetRpcUrlByNetwork = jest.fn();
jest.mock('../../../src/shared/utils/rpc', () => ({
    getRpcUrlByNetwork: (...args: any[]) => mockGetRpcUrlByNetwork(...args),
}));

const mockUsePreferences = jest.fn();
jest.mock('../../../src/store/selectors', () => ({
    usePreferences: () => mockUsePreferences(),
}));

const mockDispatch = jest.fn();
jest.mock('../../../src/store/store', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('../../../src/store/actions/uiActions', () => ({
    setPreferences: (v: any) => ({ type: 'SET_PREFS', payload: v }),
}));

const mockShowAlertModal = jest.fn();
jest.mock('../../../src/shared/utils/eventManager', () => ({
    __esModule: true,
    default: { showAlertModal: (...args: any[]) => mockShowAlertModal(...args) },
}));

const network: any = {
    chain_id: 1,
    name: 'Ethereum',
    icon: 'eth.png',
};

describe('CustomNetworkModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        restoreJsonRpcProvider();
        mockGetNetwork.mockResolvedValue({ chainId: 1n });
        mockGetBalance.mockResolvedValue(0n);
        mockGetRpcUrlByNetwork.mockReturnValue('https://default.rpc');
        mockUsePreferences.mockReturnValue({ customNetworks: [], rpcUrls: {} });
        mockDispatch.mockImplementation(() => Promise.resolve());
    });

    it('renders network info and input', () => {
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        expect(screen.getByText('Customize Network')).toBeInTheDocument();
        expect(screen.getByText('Ethereum')).toBeInTheDocument();
        expect(screen.getByTestId('rpc-input')).toBeInTheDocument();
    });

    it('does not render when invisible', () => {
        render(
            <CustomNetworkModal visible={false} onClosePress={jest.fn()} network={network} />,
        );
        expect(screen.queryByText('Customize Network')).toBeNull();
    });

    it('Reset button is disabled when not using custom RPC', () => {
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        expect(screen.getByRole('button', { name: 'Reset to Default' })).toBeDisabled();
    });

    it('Reset button is enabled when a custom RPC is configured', () => {
        mockUsePreferences.mockReturnValueOnce({
            customNetworks: [{ chain_id: 1, rpcUrl: 'https://custom.rpc' }],
            rpcUrls: {},
        });
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        expect(screen.getByRole('button', { name: 'Reset to Default' })).not.toBeDisabled();
        expect(screen.getByText(/Using custom RPC URL/)).toBeInTheDocument();
    });

    it('shows an error when saving an empty URL', async () => {
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        const input = screen.getByTestId('rpc-input') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.click(screen.getByRole('button', { name: /Save/ }));
        expect(await screen.findByText(/Please enter a valid RPC URL/)).toBeInTheDocument();
    });

    it('saves when the URL matches the default and dispatches setPreferences', async () => {
        const onClose = jest.fn();
        render(
            <CustomNetworkModal visible={true} onClosePress={onClose} network={network} />,
        );
        // Input is initialized to defaultRpcUrl, so save should not trigger validation.
        fireEvent.click(screen.getByRole('button', { name: /Save/ }));
        await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
        expect(mockToastSuccess).toHaveBeenCalledWith('RPC URL updated successfully');
        expect(onClose).toHaveBeenCalled();
    });

    it('saves a new RPC URL after successful validation', async () => {
        const onClose = jest.fn();
        render(
            <CustomNetworkModal visible={true} onClosePress={onClose} network={network} />,
        );
        const input = screen.getByTestId('rpc-input') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'https://new.rpc' } });
        fireEvent.click(screen.getByRole('button', { name: /Save/ }));
        await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'SET_PREFS',
            payload: {
                customNetworks: [{ chain_id: 1, rpcUrl: 'https://new.rpc' }],
            },
        });
        expect(onClose).toHaveBeenCalled();
    });

    it('shows an error when the RPC validation fails', async () => {
        mockGetBalance.mockRejectedValueOnce(new Error('rpc fail'));
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        const input = screen.getByTestId('rpc-input') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'https://bad.rpc' } });
        fireEvent.click(screen.getByRole('button', { name: /Save/ }));
        expect(await screen.findByText(/Invalid RPC URL/)).toBeInTheDocument();
    });

    it('warns about chain mismatch via the alert modal in non-prod builds', async () => {
        const oldBuildType = process.env.BUILD_TYPE;
        delete process.env.BUILD_TYPE;
        mockGetNetwork.mockResolvedValueOnce({ chainId: 137n });
        let confirmFn: any;
        mockShowAlertModal.mockImplementationOnce((cfg: any) => {
            confirmFn = cfg.buttons.find((b: any) => b.type === 'primary').onPress;
        });
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        const input = screen.getByTestId('rpc-input') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'https://wrong-chain.rpc' } });
        fireEvent.click(screen.getByRole('button', { name: /Save/ }));
        await waitFor(() => expect(mockShowAlertModal).toHaveBeenCalled());
        act(() => confirmFn());
        await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
        if (oldBuildType !== undefined) process.env.BUILD_TYPE = oldBuildType;
    });

    it('rejects without showing an alert modal in Prod builds when chain mismatches', async () => {
        const oldBuildType = process.env.BUILD_TYPE;
        process.env.BUILD_TYPE = 'Prod';
        mockGetNetwork.mockResolvedValueOnce({ chainId: 137n });
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        const input = screen.getByTestId('rpc-input') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'https://wrong-chain.rpc' } });
        fireEvent.click(screen.getByRole('button', { name: /Save/ }));
        expect(
            await screen.findByText(/different network/),
        ).toBeInTheDocument();
        process.env.BUILD_TYPE = oldBuildType;
    });

    it('resets to default RPC and dispatches preferences without the custom entry', async () => {
        mockUsePreferences.mockReturnValueOnce({
            customNetworks: [{ chain_id: 1, rpcUrl: 'https://custom.rpc' }],
            rpcUrls: {},
        });
        const onClose = jest.fn();
        render(
            <CustomNetworkModal visible={true} onClosePress={onClose} network={network} />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Reset to Default' }));
        await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
        expect(mockToastSuccess).toHaveBeenCalledWith('RPC URL reset to default');
        expect(onClose).toHaveBeenCalled();
    });

    it('shows save errors from the dispatch chain', async () => {
        mockDispatch.mockImplementationOnce(() => {
            throw new Error('persist fail');
        });
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        // URL matches default, so we go straight to dispatch and surface its error.
        fireEvent.click(screen.getByRole('button', { name: /Save/ }));
        expect(await screen.findByText(/persist fail/)).toBeInTheDocument();
    });

    it('shows reset errors from the dispatch chain', async () => {
        mockUsePreferences.mockReturnValueOnce({
            customNetworks: [{ chain_id: 1, rpcUrl: 'https://custom.rpc' }],
            rpcUrls: {},
        });
        mockDispatch.mockImplementationOnce(() => {
            throw new Error('reset fail');
        });
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Reset to Default' }));
        expect(await screen.findByText(/reset fail/)).toBeInTheDocument();
    });

    it('handles preferences with missing customNetworks and rpcUrls (default fallbacks)', () => {
        mockUsePreferences.mockReturnValueOnce({});
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        expect(screen.getByTestId('rpc-input')).toBeInTheDocument();
    });

    it('falls back to empty default URL when getRpcUrlByNetwork returns undefined', () => {
        mockGetRpcUrlByNetwork.mockReturnValueOnce(undefined);
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        expect(screen.getByTestId('rpc-input')).toHaveValue('');
    });

    it('uses generic save-fail message when error has no message', async () => {
        mockDispatch.mockImplementationOnce(() => {
            // eslint-disable-next-line no-throw-literal
            throw {};
        });
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        fireEvent.click(screen.getByRole('button', { name: /Save/ }));
        expect(await screen.findByText(/Failed to update RPC URL/)).toBeInTheDocument();
    });

    it('uses generic reset-fail message when reset error has no message', async () => {
        mockUsePreferences.mockReturnValueOnce({
            customNetworks: [{ chain_id: 1, rpcUrl: 'https://custom.rpc' }],
            rpcUrls: {},
        });
        mockDispatch.mockImplementationOnce(() => {
            // eslint-disable-next-line no-throw-literal
            throw {};
        });
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Reset to Default' }));
        expect(await screen.findByText(/Failed to reset RPC URL/)).toBeInTheDocument();
    });

    it('after reset, falls back to empty url when default rpc resolves to undefined', async () => {
        mockUsePreferences.mockReturnValueOnce({
            customNetworks: [{ chain_id: 1, rpcUrl: 'https://custom.rpc' }],
            rpcUrls: {},
        });
        mockGetRpcUrlByNetwork.mockReturnValue(undefined);
        render(
            <CustomNetworkModal visible={true} onClosePress={jest.fn()} network={network} />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Reset to Default' }));
        await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    });
});
