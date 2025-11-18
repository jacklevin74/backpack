import { Blockchain } from "@coral-xyz/common";
import {
  getBlockchainLogo,
  useActiveWallet,
  useBlockchainConnectionUrl,
  useUser,
} from "@coral-xyz/recoil";
import { useTheme } from "@coral-xyz/tamagui";
import { Typography } from "@mui/material";
import styled from "@mui/system/styled";

export function AvatarHeader() {
  const user = useUser();
  const theme = useTheme();
  const { blockchain } = useActiveWallet();
  const connectionUrl = useBlockchainConnectionUrl(blockchain);

  // Determine actual network from connection URL
  const getActualBlockchain = () => {
    if (connectionUrl) {
      if (
        connectionUrl.includes("solana.com") ||
        connectionUrl.includes("solana-mainnet.quiknode.pro") ||
        connectionUrl.includes("solana-devnet") ||
        connectionUrl.includes("solana-testnet")
      ) {
        return Blockchain.SOLANA;
      }
    }
    return blockchain;
  };

  const actualBlockchain = getActualBlockchain();

  return (
    <div style={{ marginBottom: "24px" }}>
      <AvatarWrapper>
        <img
          src={getBlockchainLogo(actualBlockchain)}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
          }}
          alt={actualBlockchain}
        />
      </AvatarWrapper>
      <Typography
        style={{
          color: theme.baseTextHighEmphasis.val,
          textAlign: "center",
          marginTop: "4px",
        }}
      >
        {user.username}
      </Typography>
    </div>
  );
}

const AvatarWrapper = styled("div")(() => ({
  position: "relative",
  borderRadius: "40px",
  padding: "3px",
  width: "80px",
  height: "80px",
  marginLeft: "auto",
  marginRight: "auto",
  overflow: "hidden",
  display: "block",
  "&:hover .editOverlay": {
    visibility: "visible",
  },
}));
