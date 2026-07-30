module.exports = {
    jest: {
        configure: (jestConfig) => {
            jestConfig.roots = ['<rootDir>', '<rootDir>/src', '<rootDir>/tests'];
            return jestConfig;
        },
    },
};
