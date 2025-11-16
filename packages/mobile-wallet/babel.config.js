module.exports = {
  presets: ["module:metro-react-native-babel-preset"],
  plugins: [
    ["@babel/plugin-proposal-class-properties", { loose: true }],
    ["@babel/plugin-proposal-private-methods", { loose: true }],
    [
      "module-resolver",
      {
        alias: {
          crypto: "crypto-browserify",
          stream: "stream-browserify",
          buffer: "buffer",
        },
      },
    ],
  ],
};
