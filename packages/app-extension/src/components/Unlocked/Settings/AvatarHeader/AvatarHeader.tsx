import { getBlockchainLogo, useActiveWallet, useUser } from "@coral-xyz/recoil";
import { useTheme } from "@coral-xyz/tamagui";
import { Typography } from "@mui/material";
import styled from "@mui/system/styled";

export function AvatarHeader() {
  const user = useUser();
  const theme = useTheme();
  const { blockchain } = useActiveWallet();

  return (
    <div style={{ marginBottom: "24px" }}>
      <AvatarWrapper>
        <img
          src={getBlockchainLogo(blockchain)}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
          }}
          alt={blockchain}
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
