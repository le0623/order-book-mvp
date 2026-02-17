"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { SUBNET_NAMES } from "@/lib/subnet-names";

/**
 * Minimal shape we extract from the TMC response.
 * We only care about netuid and name — everything else is discarded
 * to keep the in-memory footprint small.
 */
interface TMCSubnetEntry {
  subnet: number;
  name: string;
}

/**
 * Fetches the TMC subnets table from our server proxy and
 * transforms it into a lean Record<netuid, name> mapping.
 *
 * Returns:
 *   Record<number, string>: netuid → subnet name map.
 */
async function fetchSubnetNames(): Promise<Record<number, string>> {
  const res = await fetch("/api/tmc/subnets-table");
  if (!res.ok) throw new Error(`TMC subnets fetch failed (${res.status})`);

  const raw: TMCSubnetEntry[] = await res.json();
  const names: Record<number, string> = {};
  for (const item of raw) {
    if (item.subnet != null && item.name) {
      names[item.subnet] = item.name;
    }
  }
  return names;
}

/**
 * React Query hook that provides live subnet names and chain-derived prices.
 *
 * - Fetches once, then serves from cache for 5 minutes (staleTime).
 * - Cache persists for 1 hour even when no component subscribes (gcTime).
 * - Falls back to the static SUBNET_NAMES during loading / error.
 * - All components calling this hook share one cache entry — zero redundant fetches.
 *
 * Returns:
 *   { subnetNames, subnetPrices, getLabel, isLoading, error }
 */
export function useTMCSubnets() {
  const query = useQuery({
    queryKey: ["tmc-subnet-names"],
    queryFn: fetchSubnetNames,
    staleTime: 5 * 60 * 1000, // 5 min — names rarely change
    gcTime: 60 * 60 * 1000, // 1 hr — keep in memory long after unmount
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
  });

  // Reason: Merge TMC live data on top of static fallback so we
  // always have names for every known subnet, even during loading.
  const subnetNames = useMemo<Record<number, string>>(() => {
    if (!query.data) return SUBNET_NAMES;
    return { ...SUBNET_NAMES, ...query.data };
  }, [query.data]);

  /**
   * Returns a display label for a subnet: "SN{netuid} — {name}" or "SN{netuid}".
   *
   * Args:
   *   netuid (number): The subnet network UID.
   *
   * Returns:
   *   string: Formatted label for display.
   */
  const getLabel = useMemo(() => {
    return (netuid: number): string => {
      const name = subnetNames[netuid];
      return name ? `SN${netuid} — ${name}` : `SN${netuid}`;
    };
  }, [subnetNames]);

  return {
    /** netuid → subnet name mapping (TMC data merged over static fallback) */
    subnetNames,
    /** Format a netuid as "SN{id} — {name}" */
    getLabel,
    /** True only on initial load (no cached data yet) */
    isLoading: query.isLoading,
    /** Fetch error, if any */
    error: query.error,
  };
}
