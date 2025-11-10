import { DocumentNode } from "@apollo/client";
import { TypedDocumentNode as DocumentTypeDecoration } from "@graphql-typed-document-node/core";

/**
 * The gql function is used to parse GraphQL queries into a document that can be used by Apollo Client.
 */
export type TypedDocumentString<TResult, TVariables> =
  string & {
    __apiType?: DocumentTypeDecoration<TResult, TVariables>;
  };

export function gql(source: TemplateStringsArray): DocumentNode;
export function gql(source: string): DocumentNode;
export function gql(source: string | TemplateStringsArray): DocumentNode {
  const doc = Array.isArray(source) ? source[0] : source;

  // Use require to avoid bundling issues
  const { parse } = require("graphql");
  return parse(doc);
}
