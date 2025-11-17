import { useState } from "react";
import { useTranslation } from "@coral-xyz/i18n";
import {
  BpPrimaryButton,
  BpSecondaryButton,
  StyledText,
  YStack,
} from "@coral-xyz/tamagui";

export const CreateOrImportWallet = ({
  onNext,
}: {
  onNext: (data: any) => void;
}) => {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <YStack gap={40}>
      <div style={{ textAlign: "center" }}>
        <img
          src="x1-login-logo.png"
          alt="X1 Wallet"
          style={{ width: 96, height: 96 }}
        />
      </div>
      <YStack gap={8}>
        <StyledText
          fontSize={36}
          fontWeight="$semiBold"
          textAlign="center"
          color="#FFFFFF"
        >
          Welcome to X1 Wallet
        </StyledText>
        <StyledText color="$baseTextMedEmphasis" textAlign="center">
          {t("lets_get_started")}
        </StyledText>
      </YStack>
      <YStack gap={16} width={420}>
        <BpPrimaryButton
          label={t("create_new_wallet")}
          onPress={() => onNext({ action: "create", keyringType: "mnemonic" })}
        />
        <BpSecondaryButton
          label={t("import_wallet")}
          onPress={() => onNext({ action: "import" })}
        />

        {/* Advanced section */}
        <YStack gap={12} mt={8}>
          <StyledText
            color="$baseTextMedEmphasis"
            textAlign="center"
            cursor="pointer"
            onPress={() => setShowAdvanced(!showAdvanced)}
            hoverStyle={{ opacity: 0.8 }}
          >
            {showAdvanced ? "▲" : "▼"} {t("advanced")}
          </StyledText>
          {showAdvanced ? <BpSecondaryButton
            label={t("with_secret_key.import")}
            onPress={() =>
                onNext({ action: "import", keyringType: "mnemonic" })
              }
            /> : null}
        </YStack>
      </YStack>
    </YStack>
  );
};
