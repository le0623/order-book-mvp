import { getBlockHeight } from "@/lib/tmc-block-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/tmc/blocks
 *
 * Returns the latest block height from the server-side cache.
 * The cache is fed by a single persistent SSE connection to TMC
 * (see lib/tmc-block-cache.ts), so this endpoint is O(1) — no
 * upstream network call per request. Supports unlimited concurrent
 * clients without consuming any additional TMC SSE connections.
 *
 * Returns:
 *   JSON { height: number | null, ageMs: number }
 */
export async function GET() {
  const data = getBlockHeight();

  return Response.json(data, {
    headers: {
      // Reason: Allow browsers/CDNs to cache for 6 seconds. Blocks arrive
      // every ~12s so a 6s max-age keeps the response reasonably fresh
      // while absorbing bursts of concurrent requests.
      "Cache-Control": "public, max-age=6, stale-while-revalidate=12",
    },
  });
}
