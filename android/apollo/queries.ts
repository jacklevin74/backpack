import { gql } from "./gql";

/**
 * GraphQL query to fetch token balances for a wallet
 *
 * Returns:
 * - Aggregate portfolio value and 24h change
 * - Individual token balances with market data
 * - Token metadata (logo, name, symbol)
 *
 * @example
 * ```typescript
 * const { data } = useQuery(GET_TOKEN_BALANCES_QUERY, {
 *   variables: {
 *     address: "YOUR_WALLET_ADDRESS",
 *     providerId: "SOLANA"
 *   }
 * });
 * ```
 */
export const GET_TOKEN_BALANCES_QUERY = gql(`
  query GetTokenBalances($address: String!, $providerId: ProviderID!) {
    wallet(address: $address, providerId: $providerId) {
      id
      balances {
        id
        aggregate {
          id
          percentChange
          value
          valueChange
        }
        tokens {
          edges {
            node {
              id
              address
              amount
              decimals
              displayAmount
              marketData {
                id
                percentChange
                price
                value
                valueChange
              }
              token
              tokenListEntry {
                id
                address
                decimals
                logo
                name
                symbol
              }
            }
          }
        }
      }
    }
  }
`);
