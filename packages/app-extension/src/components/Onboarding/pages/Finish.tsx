import { useRef,useState } from "react";
import { useOnboarding } from "@coral-xyz/recoil";
import { Loader } from "@coral-xyz/tamagui";
import { useAsyncEffect } from "use-async-effect";

import { SetupComplete } from "../../common/Account/SetupComplete";

export const Finish = ({ isAddingAccount }: { isAddingAccount?: boolean }) => {
  const [loading, setLoading] = useState(true);
  const { onboardingData, createStore } = useOnboarding();
  const hasCreatedStore = useRef(false);

  useAsyncEffect(async () => {
    // Prevent creating duplicate accounts by ensuring this only runs once
    if (hasCreatedStore.current) {
      return;
    }
    hasCreatedStore.current = true;

    try {
      const res = await createStore({ ...onboardingData, isAddingAccount });
      if (!res.ok) {
        hasCreatedStore.current = false; // Allow retry on error
        if (
          confirm(
            "There was an issue setting up your account. Please try again."
          )
        ) {
          window.location.reload();
        }
      }
    } catch (err: any) {
      console.error("failed to create store", err.message);
      hasCreatedStore.current = false; // Allow retry on error
    } finally {
      setLoading(false);
    }
  }, [isAddingAccount, onboardingData, createStore, setLoading]);

  return !loading ? <SetupComplete /> : <Loader />;
};
