import { getEnv } from "@coral-xyz/common";
import { useTranslation } from "@coral-xyz/i18n";
import { userClientAtom } from "@coral-xyz/recoil";
import { safeClientResponse } from "@coral-xyz/secure-clients";
import {
  AlertOctagonIcon,
  DangerButton,
  BpPasswordInput,
  Stack,
  StyledText,
  useTheme,
} from "@coral-xyz/tamagui";
import { useState } from "react";
import { useRecoilValue } from "recoil";

import type { QueuedUiRequest } from "../_atoms/requestAtoms";
import { RequestConfirmation } from "../_sharedComponents/RequestConfirmation";

export function ResetBackpackRequest({
  currentRequest,
}: {
  currentRequest: QueuedUiRequest<"SECURE_USER_RESET_BACKPACK">;
}) {
  const { t } = useTranslation();
  const userClient = useRecoilValue(userClientAtom);
  const [password, setPassword] = useState("");
  const [hasError, setHasError] = useState(false);
  const theme = useTheme();

  const onApprove = async () => {
    if (!password.trim()) {
      return;
    }

    // Validate password before proceeding
    try {
      await safeClientResponse(
        userClient.checkPassword({
          password,
        })
      );

      // Password is correct, proceed with reset
      currentRequest.respond({
        confirmed: true,
      });

      const platform = getEnv();
      const isMobile = platform.startsWith("mobile");
      if (!isMobile) {
        //
        // On extension, we write copy to local storage of the UI so that
        // we can use it without hitting the service worker on app load.
        //
        try {
          window.localStorage.removeItem("secureUser");
        } catch {}
      }
    } catch (e) {
      // Password is incorrect
      setHasError(true);
    }
  };

  const onDeny = () => currentRequest.error(new Error("Approval Denied"));

  return (
    <RequestConfirmation
      onDeny={onDeny}
      leftButton="Cancel"
      rightButton={
        <DangerButton
          label={t("reset_backpack")}
          onPress={onApprove}
          disabled={!password.trim()}
        />
      }
    >
      <Stack>
        <Stack alignItems="center" paddingVertical="$6">
          <AlertOctagonIcon color="$redIcon" size={56} />
        </Stack>
        <Stack padding="$2" space="$4">
          <StyledText fontSize="$2xl" fontWeight="$medium" lineHeight="$2xl">
            {t("reset_backpack")}?
          </StyledText>
          <StyledText
            fontSize="$md"
            fontWeight="$medium"
            lineHeight="$md"
            color="$baseTextMedEmphasis"
          >
            {t("reset_backpack_subtitle")}
          </StyledText>
          <Stack space="$2">
            <StyledText fontSize="$sm" fontWeight="$medium" color="$redText">
              Enter your password to confirm:
            </StyledText>
            <BpPasswordInput
              placeholder="Password"
              value={password}
              onChangeText={(text: string) => {
                setPassword(text);
                setHasError(false);
              }}
              hasError={hasError}
              autoFocus
            />
            {hasError && (
              <StyledText fontSize="$xs" color="$redText" mt="$1">
                Incorrect password. Please try again.
              </StyledText>
            )}
          </Stack>
        </Stack>
      </Stack>
    </RequestConfirmation>
  );
}
