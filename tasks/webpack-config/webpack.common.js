const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const SRC_PATH = '../../Extension/modern/src';
const DIST_PATH = '../../Extension/modern/dist';

// Set staging value
const { BUILD_ENV } = process.env;
const ENVS = {
    DEV: 'dev',
    BETA: 'beta',
    RELEASE: 'release',
};

const IS_DEV = BUILD_ENV ? BUILD_ENV === ENVS.DEV : true;
const OPTIONS_PATH = path.resolve(__dirname, SRC_PATH, 'pages/options');
const BACKGROUND_PATH = path.resolve(__dirname, SRC_PATH, 'pages/background');

const config = {
    mode: IS_DEV ? 'development' : 'production',
    // TODO handle source maps
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1437937 how to handle source maps
    // eslint-disable-next-line max-len
    // https://developer.mozilla.org/en-US/docs/Tools/Debugger/Source_map_errors#NetworkError_when_attempting_to_fetch_resource
    // https://stackoverflow.com/questions/54669476/chrome-72-changes-sourcemap-behaviour
    devtool: 'inline-source-map',
    optimization: {
        minimize: false,
    },
    entry: {
        background: BACKGROUND_PATH,
        options: OPTIONS_PATH,
    },
    output: {
        path: path.resolve(__dirname, DIST_PATH),
        filename: '[name].js',
    },
    resolve: {
        extensions: ['*', '.js', '.jsx'],
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: [{ loader: 'babel-loader', options: { babelrc: true } }],
            },
            {
                test: /\.(css|pcss)$/,
                exclude: /node_modules/,
                use: [
                    'style-loader',
                    { loader: 'css-loader', options: { importLoaders: 1 } },
                    'postcss-loader',
                ],
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/,
                use: [
                    { loader: 'file-loader', options: { outputPath: 'assets' } },
                ],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.join(OPTIONS_PATH, 'index.html'),
            filename: 'options.html',
            chunks: ['options'],
        }),
        new HtmlWebpackPlugin({
            template: path.join(BACKGROUND_PATH, 'index.html'),
            filename: 'background.html',
            chunks: ['background'],
        }),
    ],
};

module.exports = config;
