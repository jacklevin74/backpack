import { DocumentNode } from "@apollo/client";
import { TypedDocumentNode as DocumentTypeDecoration } from "@graphql-typed-document-node/core";
import { parse } from "graphql";

/**
 * The gql function is used to parse GraphQL queries into a document that can be used by Apollo Client.
 * This is a simplified version for React Native compatibility.
 */
export type TypedDocumentString<TResult, TVariables> = string & {
  __apiType?: DocumentTypeDecoration<TResult, TVariables>;
};

export function gql(source: TemplateStringsArray): DocumentNode;
export function gql(source: string): DocumentNode;
export function gql(source: string | TemplateStringsArray): DocumentNode {
  const doc = Array.isArray(source) ? source[0] : source;
  return parse(doc);
}
