import { getBlockHeight } from "@/lib/block-height-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/tmc/blocks
 *
 * Returns the latest block height from the server-side cache.
 * The cache is fed by a `subscribeNewHeads` subscription over
 * the existing Bittensor RPC WebSocket — no additional connections
 * or external API calls. Supports unlimited concurrent clients.
 *
 * Returns:
 *   JSON { height: number | null, ageMs: number }
 */
export async function GET() {
  const data = getBlockHeight();

  return Response.json(data, {
    headers: {
      // Reason: Blocks arrive every ~12s. A 6s max-age keeps the response
      // fresh while absorbing bursts of concurrent requests.
      "Cache-Control": "public, max-age=6, stale-while-revalidate=12",
    },
  });
}
