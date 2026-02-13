export async function postJson(url: string, body: unknown): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((error: Error) => {
    if (error.message === "Failed to fetch") {
      throw new Error(
        "Cannot connect to server. This may be due to network issues or the server being unavailable."
      );
    }
    throw error;
  });
  return response;
}

/**
 * Extract a human-readable error message from a non-ok Response.
 */
export async function extractResponseError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type");
  let errorText: string;
  if (contentType && contentType.includes("application/json")) {
    try {
      const errorData = await response.json();
      errorText = typeof errorData === "string" ? errorData : JSON.stringify(errorData);
    } catch {
      errorText = await response.text();
    }
  } else {
    errorText = await response.text();
  }
  return `Error (${response.status}): ${errorText || response.statusText}`;
}

/**
 * Read the response body as JSON (with fallback to text).
 */
export async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }
  return await response.text();
}

/**
 * Parse backend /rec response string: "['msg', tao, alpha, price]"
 * Python's str() uses single quotes; we replace for JSON parsing.
 */
export function parseRecResponse(
  responseText: string
): { message: string; tao: number; alpha: number; price: number } | null {
  try {
    const trimmed = responseText.trim();
    if (!trimmed.startsWith("[")) return null;
    const jsonStr = trimmed.replace(/'/g, '"');
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length >= 4) {
      return {
        message: String(parsed[0] || ""),
        tao: Number(parsed[1]) || 0,
        alpha: Number(parsed[2]) || 0,
        price: Number(parsed[3]) || 0,
      };
    }
  } catch {
    /* ignore parse errors */
  }
  return null;
}
