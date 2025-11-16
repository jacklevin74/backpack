import { QUERY_ONBOARDING } from "@coral-xyz/common";
import {
  userClientAtom,
  userKeyringStoreStateAtom,
  userRequireMigrationUnlockAtom,
} from "@coral-xyz/recoil";
import { KeyringStoreState } from "@coral-xyz/secure-clients/types";
import { BanIcon } from "@coral-xyz/tamagui";
import { memo, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRecoilState, useRecoilValue, useRecoilValueLoadable } from "recoil";

import { LoginRequest } from "./LoginRequest";
import { ErrorMessage } from "../_sharedComponents/ErrorMessage";
import { Loading } from "../_sharedComponents/Loading";
import { WithMotion } from "../_sharedComponents/WithMotion";

export function RequireUserUnlocked({
  children = <>{null}</>,
  withMotion = true,
  force,
  disabled,
  onReset,
  onSuccess,
}: {
  force?: boolean; // forces password prompt (locks keyring if unlocked)
  disabled?: boolean; // no unlock. Might prompt to unlock if needed for migration.
  withMotion?: boolean;
  children?: ReactNode;
  onSuccess?: () => void;
  onReset?: () => void;
}) {
  const userKeyringStoreStateLoadable = useRecoilValueLoadable(
    userKeyringStoreStateAtom
  );
  const userRequireMigrationUnlockLoadable = useRecoilValueLoadable(
    userRequireMigrationUnlockAtom
  );
  const keyringState = userKeyringStoreStateLoadable.getValue();
  const requireMigrationUnlock = userRequireMigrationUnlockLoadable.getValue();
  const noCurrentUser = userKeyringStoreStateLoadable.errorMaybe();
  const [didUnlock, setDidUnlock] = useState(false);

  const showLogin =
    keyringState !== KeyringStoreState.Unlocked ||
    requireMigrationUnlock ||
    force;

  useEffect(() => {
    if (!showLogin && !didUnlock) {
      onSuccess?.();
      setDidUnlock(true);
    }
  }, [showLogin, didUnlock, setDidUnlock, onSuccess]);

  useEffect(() => {
    if (!disabled && keyringState === KeyringStoreState.NeedsOnboarding) {
      // Check if we're not already on the onboarding page
      const isOnOnboardingPage =
        window.location.search.includes(QUERY_ONBOARDING); // eslint-disable-line no-restricted-properties
      if (!isOnOnboardingPage) {
        // Open onboarding in full tab (like first install) instead of popup
        const url = globalThis.chrome?.runtime?.getURL(
          `options.html?${QUERY_ONBOARDING}`
        );
        if (url) {
          globalThis.chrome?.tabs?.create({ url });
          // Close the popup after opening the tab
          window.close();
        }
      }
    }
  }, [disabled, keyringState]);

  if (disabled) {
    return <>{children}</>;
  }
  if (keyringState === KeyringStoreState.NeedsOnboarding) {
    // Show loading spinner instead of black screen while opening onboarding
    return <Loading />;
  }

  if (showLogin) {
    const login = (
      <LoginRequest
        didUnlock={() => {
          setDidUnlock(true);
          onSuccess?.();
        }}
        onReset={onReset}
      />
    );

    return withMotion ? <WithMotion id="login">{login}</WithMotion> : login;
  }

  if (noCurrentUser) {
    return (
      <ErrorMessage
        icon={(iconProps) => <BanIcon {...iconProps} />}
        title="There was an error"
        body="Failed to get user info."
      />
    );
  }

  return <>{children}</>;
}
