import { lazy, Suspense, useMemo } from "react";
import { ApolloProvider } from "@apollo/client";
import { BACKPACK_CONFIG_VERSION, createApolloClient } from "@coral-xyz/common";
import { Loading } from "@coral-xyz/react-common";
import { useApolloClientHeaders, useBootstrapFast } from "@coral-xyz/recoil";
import {
  QueryClient as ReactQueryClient,
  QueryClientProvider as ReactQueryClientProvider,
} from "@tanstack/react-query";

import { Router } from "../common/Layout/Router";

// Create these once at module level to avoid recreating on every render
const reactQueryClient = new ReactQueryClient();

export function Unlocked() {
  return (
    <Suspense fallback={<Loading />}>
      <Bootstrap />
      <WithApollo>
        <ReactQueryClientProvider client={reactQueryClient}>
          <Router />
        </ReactQueryClientProvider>
      </WithApollo>
    </Suspense>
  );
}

function Bootstrap() {
  // Load bootstrap data - this will suspend if not ready
  // but with our caching improvements, it should be fast
  useBootstrapFast();
  return null;
}

function WithApollo({ children }: { children: any }) {
  const headers = useApolloClientHeaders();

  // Memoize Apollo Client to prevent recreation on every render
  // Only recreate when headers actually change
  const apolloClient = useMemo(
    () => createApolloClient(
      "backpack-extension",
      BACKPACK_CONFIG_VERSION,
      headers
    ),
    [headers]
  );

  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}
