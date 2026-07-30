/* CJS stub for the ESM-only nanoid package (jest cannot transform it). */
let counter = 0;
module.exports = {
    nanoid: () => `test-nanoid-${++counter}`,
};
