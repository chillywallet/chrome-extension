const path = require('path');
const Dotenv = require('dotenv-webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
    entry: {
        ui: './src/App.tsx',
        background: './src/Background.tsx',
        offscreen: './src/offscreen.ts',
        inpage: './src/InPage.tsx',
        contentscript: './src/ContentScript.tsx',
    },
    output: {
        filename: './scripts/[name].js',
        path: path.resolve(__dirname, '.', 'build', 'staging'),
    },
    mode: 'development',
    devtool: 'cheap-module-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            compilerOptions: { noEmit: false },
                        },
                    },
                ],
                exclude: /node_modules/,
            },
            {
                test: /\.(png|jpg|gif|svg)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'images/[hash][ext][query]',
                },
            },
            {
                test: /\.mp3|\.wav/,
                type: 'asset/resource',
                generator: {
                    filename: 'audios/[hash][ext][query]',
                },
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {},
    },
    plugins: [new NodePolyfillPlugin(), new Dotenv({ path: './.env.staging', silent: true })],
};
