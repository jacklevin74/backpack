// Stub apollo client - GraphQL removed
export const gql = (_query: any) => null;
export const useApolloClient = () => ({ query: () => Promise.resolve({ data: null }) });
