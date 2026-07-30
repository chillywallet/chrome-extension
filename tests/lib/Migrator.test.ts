// @ts-ignore — JS module
import Migrator from '../../src/lib/Migrator';

jest.mock('../../src/shared/utils/logger', () => ({
    __esModule: true,
    default: { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('Migrator', () => {
    it('uses the highest migration version as defaultVersion', () => {
        const m = new Migrator({
            migrations: [
                { version: 2, migrate: async () => ({}) },
                { version: 1, migrate: async () => ({}) },
            ],
        });
        const state = m.generateInitialState();
        expect(state.meta.version).toBe(2);
    });

    it('respects an explicit defaultVersion', () => {
        const m = new Migrator({ defaultVersion: 7 });
        expect(m.generateInitialState().meta.version).toBe(7);
    });

    it('runs only pending migrations and updates the version', async () => {
        const migrations = [
            {
                version: 1,
                migrate: async () => ({ data: { v: 1 }, meta: { version: 1 } }),
            },
            {
                version: 2,
                migrate: async () => ({ data: { v: 2 }, meta: { version: 2 } }),
            },
        ];

        const m = new Migrator({ migrations });
        const result = await m.migrateData({
            data: { v: 0 },
            meta: { version: 0 },
        });

        expect(result.meta.version).toBe(2);
        expect(result.data.v).toBe(2);
    });

    it('emits an error and stops on migration failure', async () => {
        const migrations = [
            {
                version: 1,
                migrate: async () => {
                    throw new Error('oops');
                },
            },
        ];
        const m = new Migrator({ migrations });
        const errorHandler = jest.fn();
        m.on('error', errorHandler);

        const result = await m.migrateData({ data: {}, meta: { version: 0 } });
        expect(errorHandler).toHaveBeenCalled();
        expect(result.meta.version).toBe(0);
    });
});

describe('extra branch coverage', () => {
    it('defaults to version 0 when neither migrations nor defaultVersion are given', () => {
        const m = new Migrator({});
        expect(m.generateInitialState().meta.version).toBe(0);
    });

    it('constructs with no options at all', () => {
        const m = new Migrator();
        expect(m.generateInitialState().meta.version).toBe(0);
    });

    it('migrateData uses generated initial state when called without args', async () => {
        const m = new Migrator({ defaultVersion: 1, migrations: [] });
        const result = await m.migrateData();
        expect(result.meta.version).toBe(1);
    });

    it('emits an error when migration returns empty data', async () => {
        const migrations = [
            {
                version: 1,
                migrate: async () => ({}), // missing .data
            },
        ];
        const m = new Migrator({ migrations });
        const handler = jest.fn();
        m.on('error', handler);
        const result = await m.migrateData({ data: {}, meta: { version: 0 } });
        expect(handler).toHaveBeenCalled();
        expect(result.meta.version).toBe(0);
    });

    it('emits an error when migration returns mismatched version', async () => {
        const migrations = [
            {
                version: 2,
                migrate: async () => ({ data: { v: 2 }, version: 99, meta: { version: 1 } }),
            },
        ];
        const m = new Migrator({ migrations });
        const handler = jest.fn();
        m.on('error', handler);
        await m.migrateData({ data: {}, meta: { version: 0 } });
        expect(handler).toHaveBeenCalled();
    });
});
