import type {
  FieldPolicy,
  NormalizedCacheObject,
  RequestHandler,
} from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  createHttpLink,
  from,
  InMemoryCache,
  Observable,
} from "@apollo/client";
import { RetryLink } from "@apollo/client/link/retry";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AsyncStorageWrapper, persistCache } from "apollo3-cache-persist";

// Backpack GraphQL API URL
const BACKPACK_GRAPHQL_API_URL = "https://backpack-api.xnfts.dev/v2/graphql";

const SEMVER_RX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.+)$/;

type Connection = {
  edges: Array<{ node: any }>;
  pageInfo: {
    hasNextPage: boolean;
  };
};

/**
 * Custom cache policy for transaction connections
 * Handles pagination and deduplication
 */
export function customTransactionConnectionPolicy(): FieldPolicy {
  const emptyConnection: Connection = {
    edges: [],
    pageInfo: {
      hasNextPage: true,
    },
  };

  return {
    keyArgs: ["filters", ["token"]],
    merge(
      existing: Connection = emptyConnection,
      incoming: Connection,
      { args }
    ): Connection {
      const offset = args?.filters?.offset ?? 0;
      if (offset === 0) {
        return incoming;
      }

      const merged = existing.edges.slice(0, offset + 1);
      const ids = new Set<string>();
      for (const edge of incoming.edges) {
        const id = edge.node.id ?? edge.node.__ref.split(":")[1];
        if (!ids.has(id)) {
          ids.add(id);
          merged.push(edge);
        }
      }

      return {
        edges: merged,
        pageInfo: incoming.pageInfo,
      };
    },
  };
}

// Create cache instance with type policies
const cache = new InMemoryCache({
  typePolicies: {
    Wallet: {
      fields: {
        transactions: customTransactionConnectionPolicy(),
      },
    },
  },
});

/**
 * Apollo Link handler that returns cached data on network errors
 * Provides fallback to cached data when network is unavailable
 */
export const cacheOnErrorApolloLinkHandler: RequestHandler = (
  operation,
  forward
) => {
  if (!forward) return null;

  return new Observable((observer) => {
    const subscription = forward(operation).subscribe({
      next: observer.next.bind(observer),
      complete: observer.complete.bind(observer),
      error: (networkError) => {
        const cached = cache.readQuery<any>({
          query: operation.query,
          variables: operation.variables,
        });

        if (!cached) {
          observer.next({ data: undefined, errors: [networkError] });
        } else {
          observer.next({ data: cached });
        }
        observer.complete();
      },
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  });
};

/**
 * Creates and configures an Apollo Client instance for React Native
 * @param {string} clientName - Name of the client (e.g., "backpack-android")
 * @param {string} clientVersion - Version of the client
 * @param {Record<string, string>} [headers] - Optional HTTP headers
 * @returns {ApolloClient<NormalizedCacheObject>} Configured Apollo Client
 */
export function createApolloClient(
  clientName: string,
  clientVersion: string,
  headers?: Record<string, string>
): ApolloClient<NormalizedCacheObject> {
  const httpLink = createHttpLink({
    uri: BACKPACK_GRAPHQL_API_URL,
    headers,
  });

  // Persist cache to AsyncStorage for React Native (async, non-blocking)
  persistCache({
    cache,
    storage: new AsyncStorageWrapper(AsyncStorage),
  }).catch((error) => {
    console.warn("Failed to persist Apollo cache:", error);
  });

  const version = SEMVER_RX.test(clientVersion)
    ? clientVersion.split("-")[0]
    : clientVersion;

  return new ApolloClient({
    name: clientName,
    version,
    cache,
    link: from([
      new ApolloLink(cacheOnErrorApolloLinkHandler),
      new RetryLink({
        delay: {
          initial: 500,
          max: Infinity,
          jitter: true,
        },
        attempts: {
          max: 10,
          retryIf: (error, _operation) => !!error,
        },
      }),
      httpLink,
    ]),
  });
}
