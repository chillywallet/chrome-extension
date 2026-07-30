import { normalizeLedgerDeviceErrorMessage } from '../../../src/lib/ledger/ledgerNormalizeDeviceError';
import {
    LEDGER_DEVICE_MSG_APP_INCOMPATIBILITY,
    LEDGER_DEVICE_MSG_COMMAND_UNAVAILABLE,
    LEDGER_DEVICE_MSG_INSTALL_OPEN_ETHEREUM,
    LEDGER_DEVICE_MSG_INTERNAL_DEVICE_ERROR,
    LEDGER_DEVICE_MSG_INVALID_PARAMETERS,
    LEDGER_DEVICE_MSG_INVALID_REQUEST_LENGTH,
    LEDGER_DEVICE_MSG_LICENSING_FAILED,
    LEDGER_DEVICE_MSG_PIN_NOT_CONFIGURED,
    LEDGER_DEVICE_MSG_RECOVERY_MODE,
    LEDGER_DEVICE_MSG_REQUEST_REFUSED,
    LEDGER_DEVICE_MSG_STOPPED_RESPONDING,
    LEDGER_DEVICE_MSG_TX_VALIDATION_FAILED,
    LEDGER_DEVICE_MSG_UNEXPECTED_STATE,
    LEDGER_DEVICE_MSG_UNLOCK_APPROVE,
    LEDGER_DEVICE_MSG_UNLOCK_PIN_ETHEREUM,
    LEDGER_DEVICE_MSG_USER_DECLINED,
    LEDGER_ERR_GENERIC_FALLBACK,
} from '../../../src/lib/ledger/ledgerErrorMessages';

describe('normalizeLedgerDeviceErrorMessage', () => {
    it('maps locked-device statusCode 0x5515', () => {
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x5515 })).toBe(
            LEDGER_DEVICE_MSG_UNLOCK_PIN_ETHEREUM,
        );
    });

    it('maps user declined (0x6985, 0x5501)', () => {
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6985 })).toBe(
            LEDGER_DEVICE_MSG_USER_DECLINED,
        );
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x5501 })).toBe(
            LEDGER_DEVICE_MSG_USER_DECLINED,
        );
    });

    it('maps unlock-approve 0x6982', () => {
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6982 })).toBe(
            LEDGER_DEVICE_MSG_UNLOCK_APPROVE,
        );
    });

    it('maps PIN not configured 0x5502', () => {
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x5502 })).toBe(
            LEDGER_DEVICE_MSG_PIN_NOT_CONFIGURED,
        );
    });

    it('maps install-open-ethereum 0x5123', () => {
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x5123 })).toBe(
            LEDGER_DEVICE_MSG_INSTALL_OPEN_ETHEREUM,
        );
    });

    it('maps misc APDU codes', () => {
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6700 })).toBe(
            LEDGER_DEVICE_MSG_INVALID_REQUEST_LENGTH,
        );
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6800 })).toBe(
            LEDGER_DEVICE_MSG_REQUEST_REFUSED,
        );
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6a80 })).toBe(
            LEDGER_DEVICE_MSG_TX_VALIDATION_FAILED,
        );
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6b00 })).toBe(
            LEDGER_DEVICE_MSG_INVALID_PARAMETERS,
        );
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6d00 })).toBe(
            LEDGER_DEVICE_MSG_COMMAND_UNAVAILABLE,
        );
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6e00 })).toBe(
            LEDGER_DEVICE_MSG_APP_INCOMPATIBILITY,
        );
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6f42 })).toBe(
            LEDGER_DEVICE_MSG_LICENSING_FAILED,
        );
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0xb007 })).toBe(
            LEDGER_DEVICE_MSG_UNEXPECTED_STATE,
        );
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6faa })).toBe(
            LEDGER_DEVICE_MSG_STOPPED_RESPONDING,
        );
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x662f })).toBe(
            LEDGER_DEVICE_MSG_RECOVERY_MODE,
        );
    });

    it('maps the 0x6f00..0x6fff internal range fallback', () => {
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6f01 })).toBe(
            LEDGER_DEVICE_MSG_INTERNAL_DEVICE_ERROR,
        );
        expect(normalizeLedgerDeviceErrorMessage({ statusCode: 0x6fff })).toBe(
            LEDGER_DEVICE_MSG_INTERNAL_DEVICE_ERROR,
        );
    });

    it('parses hex suffix from message when no statusCode is provided', () => {
        const err = new Error('Ledger device: Locked device (0x5515)');
        expect(normalizeLedgerDeviceErrorMessage(err)).toBe(LEDGER_DEVICE_MSG_UNLOCK_PIN_ETHEREUM);
    });

    it('returns the "Ledger device: …" core text when status is unmapped', () => {
        const msg = 'Ledger device: Some odd state (0x1234)';
        expect(normalizeLedgerDeviceErrorMessage(msg)).toBe('Some odd state.');
    });

    it('appends a period when the core message lacks one', () => {
        const msg = 'Ledger device: nope (0x1234)';
        expect(normalizeLedgerDeviceErrorMessage(msg)).toBe('nope.');
    });

    it('preserves existing trailing period', () => {
        const msg = 'Ledger device: ended. (0x1234)';
        expect(normalizeLedgerDeviceErrorMessage(msg)).toBe('ended.');
    });

    it('falls back to raw string for arbitrary errors', () => {
        expect(normalizeLedgerDeviceErrorMessage('just a string')).toBe('just a string');
    });

    it('falls back to generic message when input is empty', () => {
        expect(normalizeLedgerDeviceErrorMessage('')).toBe(LEDGER_ERR_GENERIC_FALLBACK);
        expect(normalizeLedgerDeviceErrorMessage('   ')).toBe(LEDGER_ERR_GENERIC_FALLBACK);
    });

    it('coerces non-string non-Error input via String()', () => {
        expect(normalizeLedgerDeviceErrorMessage(42)).toBe('42');
    });

    it('handles Error instance with plain message', () => {
        expect(normalizeLedgerDeviceErrorMessage(new Error('boom'))).toBe('boom');
    });

    it('treats non-integer statusCode as missing and falls back to hex parsing from Error message', () => {
        const err = Object.assign(new Error('Ledger device: oops (0x6985)'), { statusCode: 1.5 });
        expect(normalizeLedgerDeviceErrorMessage(err)).toBe(LEDGER_DEVICE_MSG_USER_DECLINED);
    });
});
