/**
 * Server-side block height cache using the existing Bittensor RPC connection.
 *
 * Architecture:
 *   Bittensor RPC (existing singleton WS) ──subscribeNewHeads──▶ this cache
 *                                                                    │
 *                                      /api/tmc/blocks ◀── getBlockHeight()
 *
 * Uses `api.rpc.chain.subscribeNewHeads()` — a single WebSocket subscription
 * over the already-open connection. No additional network calls, no external
 * APIs, no rate limits. Block headers arrive automatically every ~12 seconds.
 *
 * - Eagerly starts on module import (first block available ASAP)
 * - Shares the singleton WS from lib/bittensor.ts (no new connections)
 * - Auto-resubscribes if the connection drops and reconnects
 */

import { getApi } from "./bittensor";

interface BlockCache {
  height: number | null;
  updatedAt: number;
}

let cache: BlockCache = { height: null, updatedAt: 0 };
let unsubscribe: (() => void) | null = null;
let isSubscribing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Returns the latest cached block height and its age in milliseconds.
 */
export function getBlockHeight(): { height: number | null; ageMs: number } {
  return {
    height: cache.height,
    ageMs: cache.updatedAt > 0 ? Date.now() - cache.updatedAt : Infinity,
  };
}

/**
 * Subscribe to new block headers via the existing Polkadot.js API singleton.
 * Runs entirely on the server — never called from client code.
 */
async function subscribe(): Promise<void> {
  if (isSubscribing || unsubscribe) return;
  isSubscribing = true;

  try {
    const api = await getApi();

    // Reason: subscribeNewHeads uses the existing WebSocket subscription
    // mechanism — no additional HTTP requests or connections. The chain
    // pushes headers to us every ~12 seconds automatically.
    const unsub = await api.rpc.chain.subscribeNewHeads((header) => {
      const height = header.number.toNumber();
      cache = { height, updatedAt: Date.now() };
    });

    unsubscribe = () => {
      unsub();
      unsubscribe = null;
    };

    // Reason: If the API disconnects, clear our subscription so we
    // re-subscribe when the connection comes back.
    api.on("disconnected", () => {
      unsubscribe = null;
      scheduleRetry();
    });

    console.log("[Block Cache] Subscribed to new block headers via chain RPC");
  } catch (err) {
    console.error("[Block Cache] Failed to subscribe:", err);
    scheduleRetry();
  } finally {
    isSubscribing = false;
  }
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    subscribe();
  }, 10_000); // Retry after 10s — plenty of time for WS to reconnect
}

// Reason: Eagerly start on module import so the first block height is
// cached before any client request arrives. subscribeNewHeads fires the
// callback immediately with the current head — no waiting for next block.
subscribe();
