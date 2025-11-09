const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  crypto: require.resolve("crypto-browserify"),
  stream: require.resolve("stream-browserify"),
  events: require.resolve("events"),
};

module.exports = config;
