/**
 * Server-side singleton that maintains ONE SSE connection to TMC
 * and caches the latest block height in memory.
 *
 * Architecture:
 *   TMC SSE ──(1 connection)──▶ this cache ──(N requests)──▶ all API clients
 *
 * This module is imported by the API route. Node.js module caching ensures
 * only one instance exists per server process, so we never open more than
 * one upstream SSE connection regardless of how many clients connect.
 *
 * - Auto-connects on first import
 * - Auto-reconnects with exponential backoff (3s → 6s → 12s, max 30s)
 * - Exposes getBlockHeight() for the API route to read
 */

const TMC_PUBLIC_URL =
  "https://api.taomarketcap.com/public/v1/sse/blocks/";

const INITIAL_RECONNECT_MS = 3_000;
const MAX_RECONNECT_MS = 30_000;

interface BlockCache {
  height: number | null;
  updatedAt: number; // Date.now() of last update
}

// Module-level state — persists across requests within one server process
let cache: BlockCache = { height: null, updatedAt: 0 };
let abortController: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = INITIAL_RECONNECT_MS;
let isConnecting = false;

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
 * Parses a `data:` line from the TMC SSE stream.
 * Expected format: data: {"height": 7559672}
 */
function parseSSEChunk(raw: string): number | null {
  const lines = raw.split("\n");
  for (const line of lines) {
    const match = line.match(/^data:\s*(.+)$/);
    if (!match) continue;
    try {
      const payload = JSON.parse(match[1]);
      if (payload.height != null) return Number(payload.height);
    } catch {
      // Not valid JSON — skip
    }
  }
  return null;
}

/**
 * Opens a single SSE connection to TMC and pumps block heights into the cache.
 * Runs entirely on the server — never called from client code.
 */
async function connect(): Promise<void> {
  if (isConnecting) return;
  isConnecting = true;

  const apiKey = process.env.TMC_API_KEY;

  // Reason: AbortController lets us cleanly tear down the fetch on reconnect.
  abortController = new AbortController();

  try {
    const res = await fetch(TMC_PUBLIC_URL, {
      headers: {
        "User-Agent": "TrustedStake-Backend/1.0",
        Accept: "text/event-stream",
        ...(apiKey ? { Authorization: apiKey } : {}),
      },
      cache: "no-store",
      signal: abortController.signal,
    });

    if (!res.ok || !res.body) {
      console.error(`[TMC Block Cache] Upstream returned ${res.status}`);
      scheduleReconnect();
      return;
    }

    // Successfully connected — reset backoff
    reconnectDelay = INITIAL_RECONNECT_MS;
    isConnecting = false;
    console.log("[TMC Block Cache] Connected — streaming block heights");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        const height = parseSSEChunk(raw);

        if (height !== null) {
          cache = { height, updatedAt: Date.now() };
        }
      }
    } catch (err: unknown) {
      // AbortError is expected during teardown — don't log it
      if (err instanceof DOMException && err.name === "AbortError") return;
    }

    // Stream ended — reconnect
    console.log("[TMC Block Cache] Stream ended, reconnecting…");
    scheduleReconnect();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    console.error("[TMC Block Cache] Connection failed:", err);
    scheduleReconnect();
  } finally {
    isConnecting = false;
  }
}

function scheduleReconnect(): void {
  isConnecting = false;
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelay);

  // Exponential backoff
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS);
}

// Reason: Auto-start on first import. This runs once when the module is
// first required by the server process — subsequent imports are no-ops
// due to Node.js module caching.
connect();
