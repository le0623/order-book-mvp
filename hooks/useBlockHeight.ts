"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const BLOCKS_API_URL = "/api/tmc/blocks";
const POLL_INTERVAL_MS = 12_000; // ~1 Bittensor block time

interface BlockHeightState {
  /** Current block height, or null if not yet received */
  height: number | null;
  /** True until the first block height arrives */
  loading: boolean;
  /** True when the last fetch succeeded */
  connected: boolean;
}

/**
 * Hook that polls the block height from our server-side cache.
 *
 * The server maintains a single SSE connection to TMC and caches
 * the latest block. This hook simply polls that cache every ~12s,
 * keeping client-side overhead near zero and consuming no additional
 * TMC SSE connections regardless of how many users are active.
 *
 * Returns:
 *   { height, loading, connected }
 */
export function useBlockHeight(): BlockHeightState {
  const [height, setHeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBlock = useCallback(async () => {
    try {
      const res = await fetch(BLOCKS_API_URL);
      if (!res.ok) {
        setConnected(false);
        return;
      }
      const data = await res.json();
      if (data.height != null) {
        setHeight(data.height);
        setLoading(false);
        setConnected(true);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    // Fetch immediately on mount
    fetchBlock();

    // Then poll every ~12 seconds
    timerRef.current = setInterval(fetchBlock, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchBlock]);

  return { height, loading, connected };
}
