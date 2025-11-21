export const EthereumConnectionUrl = {
  MAINNET: "https://mobile-api.x1.xyz/ethereum-rpc-proxy",
  GOERLI:
    "https://eth-goerli.g.alchemy.com/v2/6QnM1O0pB17Qo47Cw9qMipDGWX7xAVWc",
  SEPOLIA:
    "https://eth-sepolia.g.alchemy.com/v2/6QnM1O0pB17Qo47Cw9qMipDGWX7xAVWc",
  DEFAULT:
    process.env.DEFAULT_ETHEREUM_CONNECTION_URL ||
    "https://mobile-api.x1.xyz/ethereum-rpc-proxy",
};

export const EthereumChainIds = {
  "0x1": "MAINNET",
  "0x5": "GOERLI",
  "0xaa36a7": "SEPOLIA",
};
