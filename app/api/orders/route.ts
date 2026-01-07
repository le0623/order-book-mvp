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
    // Get the request body from the frontend
    const body = await request.json();

    // Log the request for debugging (remove in production)
    console.log('📤 Sending to backend:', JSON.stringify(body, null, 2));

    // Forward the request to the external API
    const response = await fetch(`${EXTERNAL_API_URL}/rec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Log response status for debugging
    console.log('📥 Backend response status:', response.status);

    // Get the response data - handle both JSON and plain text responses
    let data: any;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      // Try to parse as JSON
      try {
        data = await response.json();
      } catch (error) {
        // If JSON parsing fails, get as text
        const text = await response.text();
        data = { error: text || response.statusText };
      }
    } else {
      // If not JSON, get as text
      const text = await response.text();
      data = { error: text || response.statusText };
    }

    // Return the response to the frontend with proper CORS headers
    // (Not needed for same-origin, but good practice)
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: any) {
    console.error('❌ Proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to proxy request to external API' },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 * (Not strictly necessary for same-origin, but included for completeness)
 */
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

