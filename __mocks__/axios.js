// Manual mock so test files that transitively import axios don't trip over
// axios v1's ESM-only entry point under Jest. Tests that need rich axios
// behavior can still override this via jest.mock().
const axios = {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    request: jest.fn(() => Promise.resolve({ data: {} })),
    create: jest.fn(() => axios),
    defaults: { headers: { common: {} } },
    interceptors: {
        request: { use: jest.fn(), eject: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn() },
    },
};

module.exports = axios;
module.exports.default = axios;
