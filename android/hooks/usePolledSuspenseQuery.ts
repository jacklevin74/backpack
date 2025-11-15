import {
  type OperationVariables,
  type SuspenseQueryHookOptions,
  useSuspenseQuery,
} from "@apollo/client";
import { startTransition, useEffect } from "react";

/**
 * Wrapper hook around the Apollo client `useSuspenseQuery` to add intervalled
 * polling of new data based on the argued interval length in seconds.
 *
 * Features:
 * - Automatically refetches data at the specified interval
 * - Supports Suspense for loading states
 * - Can be disabled by passing "disabled" as interval
 * - Uses React's startTransition for non-blocking updates
 *
 * @template TData - The type of data returned by the query
 * @template TVariables - The type of variables passed to the query
 * @template TOptions - Additional options for the query
 * @param {number | "disabled"} intervalSeconds - Polling interval in seconds, or "disabled" to disable polling
 * @param {...Parameters<typeof useSuspenseQuery>} args - Arguments passed to useSuspenseQuery
 * @returns Query result with data, loading state, error, and refetch function
 *
 * @example
 * ```typescript
 * const { data, error, refetch } = usePolledSuspenseQuery(
 *   60, // Poll every 60 seconds
 *   GET_TOKEN_BALANCES_QUERY,
 *   {
 *     variables: { address: "...", providerId: "SOLANA" }
 *   }
 * );
 * ```
 */
export function usePolledSuspenseQuery<
  TData,
  TVariables extends OperationVariables,
  TOptions extends Omit<
    SuspenseQueryHookOptions<TData, OperationVariables>,
    "variables"
  >,
>(
  intervalSeconds: number | "disabled",
  ...args: Parameters<typeof useSuspenseQuery<TData, TVariables, TOptions>>
): ReturnType<
  typeof useSuspenseQuery<TData | undefined, TVariables, TOptions>
> {
  const res = useSuspenseQuery(...args);

  useEffect(() => {
    if (intervalSeconds === "disabled" || intervalSeconds <= 0) {
      return () => {};
    }

    const id = setInterval(() => {
      // Use startTransition if available for non-blocking updates
      if (typeof startTransition === "function") {
        startTransition(() => {
          res.refetch();
        });
      } else {
        res.refetch();
      }
    }, intervalSeconds * 1000);

    return () => {
      clearInterval(id);
    };
  }, [intervalSeconds, res]);

  return res;
}
