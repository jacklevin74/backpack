import { BACKEND_API_URL } from "@coral-xyz/common";

import type { ProviderId } from "../../apollo/graphql";

export interface Transaction {
  hash: string;
  type: string;
  timestamp: string;
  amount?: string;
  tokenName?: string;
  tokenSymbol?: string;
  fee?: string;
  feePayer?: string;
  description?: string;
  error?: string | null;
  nfts?: any[];
  source?: string | null;
}

export interface TransactionResponse {
  transactions: Transaction[];
  hasMore: boolean;
}

export async function fetchTransactionsFromServer(
  address: string,
  providerId: ProviderId,
  limit: number = 50,
  offset: number = 0,
  tokenMint?: string
): Promise<TransactionResponse> {
  try {
    const url = `${BACKEND_API_URL}/transactions`;
    console.log("🌐 [TransactionHistory] Fetching from:", url);

    const requestBody = {
      address,
      providerId,
      limit,
      offset,
      ...(tokenMint && { tokenMint }),
    };
    console.log("📤 [TransactionHistory] Request body:", requestBody);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ [TransactionHistory] Response:", {
      count: result.transactions?.length || 0,
      hasMore: result.hasMore,
    });

    return {
      transactions: result.transactions || [],
      hasMore: result.hasMore || false,
    };
  } catch (error) {
    console.error("❌ [TransactionHistory] Error:", error);
    return {
      transactions: [],
      hasMore: false,
    };
  }
}
