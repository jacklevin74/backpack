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
import { LocalStorageWrapper, persistCacheSync } from "apollo3-cache-persist";

import { BACKEND_API_URL, X1_JSON_SERVER_URL, BACKPACK_GRAPHQL_API_URL } from "../constants";

const cache = new InMemoryCache({
  addTypename: true,
  typePolicies: {
    Wallet: {
      fields: {
        transactions: customTransactionConnectionPolicy(),
      },
    },
  },
});

const SEMVER_RX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.+)$/;

type Connection = {
  edges: Array<{ node: any }>;
  pageInfo: {
    hasNextPage: boolean;
  };
};

export function customNftConnectionPolicy(): FieldPolicy {
  const emptyConnection: Connection = {
    edges: [],
    pageInfo: {
      hasNextPage: true,
    },
  };

  return {
    keyArgs: ["filters", ["addresses", "collection"]],
    merge(
      existing: Connection = emptyConnection,
      incoming: Connection,
      { args }
    ): Connection {
      const page = args?.filters?.page ?? 1;
      if (page === 1) {
        return incoming;
      }

      const merged = existing.edges.slice(0);
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
 * X1 Interceptor Link - Routes X1 queries to local JSON server
 */
export const x1InterceptorLink = new ApolloLink((operation, forward) => {
  const { variables } = operation;

  console.log("🔍 [X1Interceptor] Checking operation:", {
    operationName: operation.operationName,
    variables,
    providerId: variables?.providerId,
  });

  // Check if this is an X1 query by looking at the providerId variable
  const providerId = variables?.providerId || '';
  const isX1Query = providerId === "X1" || providerId === "X1-testnet" || providerId === "X1-mainnet";

  if (!isX1Query) {
    console.log("⏭️ [X1Interceptor] Not X1 query, passing through to backend");
    // Not an X1 query, pass through to regular GraphQL endpoint
    return forward(operation);
  }

  console.log(
    "🔵 [X1Interceptor] X1 Query Intercepted:",
    operation.operationName,
    "providerId:",
    providerId
  );

  // Handle X1 queries by fetching from JSON server
  return new Observable((observer) => {
    const address = variables?.address;

    if (!address) {
      console.error("❌ [X1Interceptor] Missing address in X1 query");
      observer.error(new Error("X1 query missing address"));
      return;
    }

    // Use the providerId directly - it already contains network info (X1, X1-testnet, or X1-mainnet)
    const url = `${X1_JSON_SERVER_URL}/wallet/${address}?providerId=${providerId}`;
    console.log("🌐 [X1Interceptor] Fetching from JSON server:", url, `(providerId: ${providerId})`);

    // Fetch balance from JSON server
    fetch(url)
      .then((res) => {
        console.log(
          "📡 [X1Interceptor] JSON server response status:",
          res.status
        );
        return res.json();
      })
      .then((data) => {
        console.log("✅ [X1Interceptor] JSON Server Response:", data);

        // Calculate lamports from balance
        const lamports = Math.floor(data.balance * 1e9);

        // Transform JSON server response to GraphQL format
        const graphqlData = {
          wallet: {
            __typename: "Wallet",
            id: address,
            balances: {
              __typename: "Balances",
              tokens: {
                __typename: "TokenBalanceConnection",
                edges: data.tokens.map((token: any) => ({
                  __typename: "TokenBalanceEdge",
                  node: {
                    __typename: "TokenBalance",
                    id: "x1-native",
                    address: token.mint,
                    amount: lamports.toString(),
                    decimals: token.decimals,
                    displayAmount: token.balance.toFixed(4),
                    token: token.mint,
                    tokenListEntry: {
                      __typename: "TokenListEntry",
                      id: "xnt",
                      address: token.mint,
                      decimals: token.decimals,
                      logo: token.logo,
                      name: token.name,
                      symbol: token.symbol,
                    },
                    marketData: {
                      __typename: "TokenMarketData",
                      id: "xnt-market",
                      price: token.price,
                      value: token.valueUSD,
                      percentChange: 0,
                      valueChange: 0,
                    },
                  },
                })),
              },
            },
          },
        };

        console.log(
          "📦 [X1Interceptor] Transformed GraphQL data:",
          graphqlData
        );
        console.log(
          "📦 [X1Interceptor] Token edges count:",
          graphqlData.wallet.balances.tokens.edges.length
        );

        observer.next({ data: graphqlData });
        observer.complete();
      })
      .catch((error) => {
        console.error("❌ [X1Interceptor] JSON Server Error:", error);
        observer.error(error);
      });
  });
});
/**
 * Synchronously persist any cache wrapper and return a configured Apollo client instance.
 * @export
 * @param {string} clientName
 * @param {string} clientVersion
 * @param {Record<string, string>} [headers]
 * @returns {ApolloClient<NormalizedCacheObject>}
 */
export function createApolloClient(
  clientName: string,
  clientVersion: string,
  headers?: Record<string, string>
): ApolloClient<NormalizedCacheObject> {
  const httpLink = createHttpLink({
    uri: BACKPACK_GRAPHQL_API_URL,  // Use official Backpack GraphQL API
    headers,
  });

  // Logging link to debug GraphQL queries
  const loggingLink = new ApolloLink((operation, forward) => {
    console.log("🚀 GraphQL Query:", operation.operationName);
    console.log("📋 Query:", operation.query.loc?.source.body);
    console.log("🔧 Variables:", JSON.stringify(operation.variables, null, 2));
    console.log("🌐 GraphQL URL:", BACKPACK_GRAPHQL_API_URL);
    return forward(operation).map((response) => {
      console.log("✅ Response for", operation.operationName, ":", response);
      return response;
    });
  });

  // Temporarily disable cache persistence for X1 development
  // persistCacheSync({
  //   cache,
  //   storage: new LocalStorageWrapper(window.localStorage),
  // });

  const version = SEMVER_RX.test(clientVersion)
    ? clientVersion.split("-")[0]
    : clientVersion;

  return new ApolloClient({
    name: clientName,
    version,
    cache,
    defaultOptions: {
      watchQuery: {
        errorPolicy: "all",
      },
      query: {
        errorPolicy: "all",
      },
    },
    link: from([
      loggingLink,
      x1InterceptorLink, // X1 interceptor MUST come before other links
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
