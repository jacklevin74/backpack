import type { GetTokenBalancesQuery } from "../../apollo/graphql";

export type ResponseBalanceSummary = {
  id: string;
  percentChange: number;
  value: number;
  valueChange: number;
};

export type ResponseTokenBalance = NonNullable<
  NonNullable<
    NonNullable<GetTokenBalancesQuery["wallet"]>["balances"]
  >["tokens"]
>["edges"][number]["node"];
