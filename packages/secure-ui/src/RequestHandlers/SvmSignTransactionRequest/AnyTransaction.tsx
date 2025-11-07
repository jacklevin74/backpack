import { Blockchain } from "@coral-xyz/common";
import { DEFAULT_SOLANA_CLUSTER } from "@coral-xyz/secure-background/legacyCommon";
import { SolanaClient } from "@coral-xyz/secure-clients";
import { useState } from "react";
import {
  useRecoilStateLoadable,
  useRecoilValue,
  useRecoilValueLoadable,
} from "recoil";

import { TransactionSettings } from "./TransactionSettings";
import { useFetchSolanaBlowfishEvaluation } from "./useFetchSolanaBlowfishEvaluation";
import { RequireUserUnlocked } from "../../RequireUserUnlocked/RequireUserUnlocked";
import type { QueuedUiRequest } from "../../_atoms/requestAtoms";
import { solanaMutatedTransactionAtom } from "../../_atoms/solanaMutatedTransactionAtom";
import { solanaPublicKeyHasGas } from "../../_atoms/solanaTransactionAtom";
import { solanaTransactionMutLockedNftsAtom } from "../../_atoms/solanaTransactionMutLockedNftsAtom";
import { solanaTxIsMutableAtom } from "../../_atoms/solanaTxIsMutableAtom";
import { solanaTxOverridesAtom } from "../../_atoms/solanaTxOverridesAtom";
import {
  BlowfishTransactionDetails,
  BlockingWarning,
  BlowfishCrossChainResult,
} from "../../_sharedComponents/BlowfishEvaluation";
import { Loading } from "../../_sharedComponents/Loading";

export function AnyTransaction({
  currentRequest,
}: {
  currentRequest: QueuedUiRequest<"SECURE_SVM_SIGN_TX">;
}) {
  const notBackpack = ["browser", "xnft"].includes(
    currentRequest.event.origin.context
  );
  const mutatedTransactionLoadable = useRecoilValueLoadable(
    solanaMutatedTransactionAtom(currentRequest.request)
  );
  const mutatedTransaction = mutatedTransactionLoadable.valueMaybe();
  const [blowfishError, setBlowfishError] = useState(false);
  const [showSimulationFailed, setShowSimulationFailed] = useState(true);

  // Skip Blowfish evaluation for X1 blockchain (not supported)
  const isX1Transaction = currentRequest.request.blockchain === Blockchain.X1;

  const isTxMutable = useRecoilValue(
    solanaTxIsMutableAtom(currentRequest.request)
  );
  const hasGasLoadable = useRecoilValueLoadable(
    solanaPublicKeyHasGas(currentRequest.request)
  );
  const mutableLockedNftsLoadable = useRecoilValueLoadable(
    solanaTransactionMutLockedNftsAtom({
      txs: [currentRequest.request.tx],
      publicKey: currentRequest.request.publicKey,
    })
  );
  const hasGas = hasGasLoadable.valueMaybe() ?? true;
  const mutableLockedNfts = mutableLockedNftsLoadable.valueMaybe() ?? [];

  // Pass connection URL to detect X1 and skip Blowfish evaluation
  const blowfishEvaluation = useFetchSolanaBlowfishEvaluation(
    SolanaClient.config.blowfishUrl,
    [currentRequest.request.tx],
    currentRequest.event.origin.address,
    currentRequest.request.publicKey,
    (error) => {
      if (!isX1Transaction) {
        setBlowfishError(true);
        console.error(error);
      }
    },
    DEFAULT_SOLANA_CLUSTER
  );

  const [transactionOverridesLoadable, setTransactionOverrides] =
    useRecoilStateLoadable(solanaTxOverridesAtom(currentRequest.request));
  const transactionOverrides = transactionOverridesLoadable.valueMaybe();

  const onApprove = () => {
    if (!mutatedTransaction) {
      console.error("unable to fetch or parse transaction data");
      return;
    }
    currentRequest.respond({
      tx: mutatedTransaction,
      confirmed: true,
    });
  };

  const onDeny = () => currentRequest.error(new Error("Approval Denied"));

  if (
    mutableLockedNftsLoadable.state === "hasValue" &&
    mutableLockedNfts.length > 0
  ) {
    const lockedNft = mutableLockedNfts[0];
    return (
      <BlockingWarning
        warning={{
          severity: "CRITICAL",
          kind: "warning",
          message: `Collection ${lockedNft.collection?.name} is locked. This transaction would affect ${lockedNft?.name} (${lockedNft.token}). If this is intentional, unlock the collection first.`,
        }}
        onDeny={onDeny}
      />
    );
  }

  const customWarnings: BlowfishCrossChainResult["warnings"] = [];
  if (mutableLockedNftsLoadable.state === "hasError") {
    customWarnings.push({
      message:
        "Failed to verify locked collections. This transaction MAY affect NFTs you locked. Proceed with caution.",
      severity: "WARNING" as const,
      kind: "error",
    });
  }
  // Skip gas check for X1 - it checks SOL balance but X1 uses XNT
  if (!isX1Transaction && hasGas !== true) {
    customWarnings.push({
      message:
        "Not enought SOL to pay for gas. Top up your wallet and try again.",
      severity: "CRITICAL" as const,
      kind: "error",
    });
  }

  return (
    <RequireUserUnlocked
      onReset={() => currentRequest.error(new Error("Login Failed"))}
    >
      {blowfishEvaluation.isLoading ? (
        <Loading />
      ) : !isX1Transaction &&
        (blowfishError ||
          blowfishEvaluation.error ||
          !blowfishEvaluation.normalizedEvaluation) &&
        showSimulationFailed ? (
        <BlockingWarning
          title="Simulation failed"
          warning={{
            severity: "WARNING",
            kind: "error",
            message: "Please try again.",
          }}
          onIgnore={() => setShowSimulationFailed(false)}
          onDeny={onDeny}
        />
      ) : (
        <BlowfishTransactionDetails
          origin={currentRequest.event.origin}
          signerPublicKey={currentRequest.request.publicKey}
          isApproveLoading={!mutatedTransaction}
          onDeny={onDeny}
          onApprove={onApprove}
          evaluation={blowfishEvaluation.normalizedEvaluation}
          customWarnings={customWarnings}
          prepend={
            isTxMutable && transactionOverrides
              ? [
                  <TransactionSettings
                    key="TransactionSettings"
                    overrides={transactionOverrides}
                    setOverrides={setTransactionOverrides}
                  />,
                ]
              : undefined
          }
        />
      )}
    </RequireUserUnlocked>
  );
}
