"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const BLOCKS_API_URL = "/api/tmc/blocks";
const FAST_POLL_MS = 2_000;  // Poll every 2s until first block arrives
const SLOW_POLL_MS = 12_000; // Then relax to ~1 block time

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
 * The server subscribes to chain block headers over the existing
 * Bittensor RPC WebSocket and caches the latest height. This hook
 * polls that cache — fast at first (2s) until the first block arrives,
 * then slows to 12s to stay lightweight.
 *
 * Returns:
 *   { height, loading, connected }
 */
export function useBlockHeight(): BlockHeightState {
  const [height, setHeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasDataRef = useRef(false);

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
        hasDataRef.current = true;
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Reason: Poll fast until we get the first block, then slow down.
    // This avoids the long "—" on initial page load while keeping
    // steady-state overhead minimal.
    const poll = async () => {
      if (cancelled) return;
      await fetchBlock();
      if (cancelled) return;
      const delay = hasDataRef.current ? SLOW_POLL_MS : FAST_POLL_MS;
      timerRef.current = setTimeout(poll, delay);
    };

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchBlock]);

  return { height, loading, connected };
}
