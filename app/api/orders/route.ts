import { NextRequest, NextResponse } from 'next/server';

const EXTERNAL_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.subnet118.com';

/**
 * Next.js API Route Handler - Proxies POST requests to external API
 * 
 * This route acts as a proxy to bypass CORS restrictions:
 * - Frontend calls /api/orders (same origin, no CORS)
 * - This server-side route calls the external API (server-to-server, no CORS)
 * - Returns the response to the frontend
 * 
 * @param request - Next.js request object containing the order data
 * @returns Response from external API or error response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${EXTERNAL_API_URL}/rec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    let data: any;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (error) {
        const text = await response.text();
        data = { error: text || response.statusText };
      }
    } else {
      const text = await response.text();
      data = { error: text || response.statusText };
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to proxy request to external API' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

