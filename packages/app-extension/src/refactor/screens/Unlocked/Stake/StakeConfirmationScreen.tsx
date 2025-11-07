import { useState } from "react";
import { generateUniqueId } from "@coral-xyz/common";
import { useTranslation } from "@coral-xyz/i18n";
import { CheckIcon, Loading, SecondaryButton } from "@coral-xyz/react-common";
import {
  solanaClientAtom,
  useActiveWallet,
  useBlockchainConnectionUrl,
  useBlockchainExplorer,
} from "@coral-xyz/recoil";
import { explorerUrl } from "@coral-xyz/secure-background/legacyCommon";
import { sleep } from "@coral-xyz/staking/src/shared";
import { PrimaryButton, StyledText } from "@coral-xyz/tamagui";
import { useQueryClient } from "@tanstack/react-query";
import { useRecoilValue } from "recoil";
import useAsyncEffect from "use-async-effect";

import { ScreenContainer } from "../../../components/ScreenContainer";
import {
  Routes,
  type StakeScreenProps,
} from "../../../navigation/StakeNavigator";

export function StakeConfirmationScreen(
  props: StakeScreenProps<Routes.StakeConfirmationScreen>
) {
  return (
    <ScreenContainer loading={<LoadingContainer />}>
      <Container {...props} />
    </ScreenContainer>
  );
}

function LoadingContainer() {
  return null;
}

const Container = ({
  navigation,
  route: {
    params: { signature, delay = 1000, afterTitle },
  },
}: StakeScreenProps<Routes.StakeConfirmationScreen>) => {
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);
  const { blockchain, publicKey } = useActiveWallet();
  const queryClient = useQueryClient();
  const solanaClient = useRecoilValue(solanaClientAtom);
  const explorer = useBlockchainExplorer(blockchain);
  const connectionUrl = useBlockchainConnectionUrl(blockchain);
  const [error, setError] = useState<string>();

  useAsyncEffect(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    async (isMounted) => {
      try {
        await solanaClient.confirmTransaction(signature);

        await Promise.allSettled([
          // Give enough time for UI to update
          sleep(delay),
          // Clear react-query cache
          queryClient.invalidateQueries({
            queryKey: ["staking", publicKey],
          }),
        ]);

        if (isMounted()) {
          setConfirmed(true);
          navigation.setOptions({
            title: afterTitle,
          });
        }
      } catch (err: any) {
        if (isMounted()) {
          console.error(err);
          setError(err.message || "Error");
        }
      }
    },
    [signature]
  );

  return (
    <div
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        textAlign: "center",
        flex: 1,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        {error ? (
          <StyledText color="$redText">
            There was an error confirming this transaction: '{error}'
          </StyledText>
        ) : confirmed ? (
          <CheckIcon />
        ) : (
          <Loading
            size={48}
            iconStyle={{
              display: "flex",
              marginLeft: "auto",
              marginRight: "auto",
            }}
            thickness={6}
          />
        )}
      </div>

      {error || confirmed ? (
        <PrimaryButton
          onClick={() =>
            navigation.navigate(Routes.ListStakesScreen, {
              forceRefreshKey: generateUniqueId(),
            })
          }
          label={t("view_stakes")}
        />
      ) : null}
      <div style={{ marginTop: 16 }}>
        <SecondaryButton
          label={t("view_explorer")}
          type="button"
          onClick={() => {
            window.open(
              explorerUrl(explorer, signature, connectionUrl),
              "_blank"
            );
          }}
        />
      </div>
    </div>
  );
};
