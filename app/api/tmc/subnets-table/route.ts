import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TMC_INTERNAL_URL =
  "https://api.taomarketcap.com/internal/v1/subnets/table";

/**
 * GET /api/tmc/subnets-table
 *
 * Server-side proxy to TaoMarketCap's internal subnets table endpoint.
 * Keeps the browser from hitting TMC directly (no CORS, no key exposure).
 *
 * Returns:
 *   TMCSubnetTableItem[] — flat JSON array of all subnets.
 */
export async function GET() {
  try {
    const res = await fetch(TMC_INTERNAL_URL, {
      headers: {
        "User-Agent": "TrustedStake-Backend/1.0",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `TMC API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "TMC proxy request failed";
    console.error("[TMC Proxy]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
