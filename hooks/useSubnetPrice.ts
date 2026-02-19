"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSubnetPrice } from "@/lib/bittensor";

/**
 * React Query hook that queries the Bittensor chain directly for
 * a subnet's alpha token spot price (ground truth from pool reserves).
 *
 * - Only queries when a valid netuid is provided.
 * - Caches for 30s (staleTime) — chain state changes every ~12s block.
 * - Cache persists 5 min (gcTime) after all subscribers unmount.
 *
 * Args:
 *   netuid (number | undefined): The subnet to query price for.
 *
 * Returns:
 *   { price, isLoading, error }
 */
export function useSubnetPrice(netuid: number | undefined) {
  const query = useQuery({
    queryKey: ["subnet-price-chain", netuid],
    queryFn: () => fetchSubnetPrice(netuid!),
    enabled: netuid != null && netuid > 0,
    staleTime: 30_000, // 30s — reasonably fresh without hammering RPC
    gcTime: 5 * 60_000, // 5 min
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    /** Spot price in TAO per alpha (chain-derived), or 0 if unavailable */
    price: query.data ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}
