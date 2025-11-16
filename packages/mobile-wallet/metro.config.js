const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    extraNodeModules: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
    },
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json'],
  },
  watchFolders: [
    path.resolve(__dirname, '../../node_modules'),
  ],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
