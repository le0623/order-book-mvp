/**
 * Shared WebSocket message parsing utilities.
 * Handles the double-encoded JSON pattern used by the backend.
 */

/**
 * Parse a raw WebSocket message that may be:
 * - already an object
 * - a JSON string
 * - a double-encoded JSON string (JSON string inside a JSON string)
 *
 * Returns the parsed object or null on failure.
 */
export function parseWsMessage<T = unknown>(message: unknown): T | null {
  if (message == null) return null;

  // Already an object
  if (typeof message === "object") return message as T;

  if (typeof message !== "string") return null;

  try {
    let parsed = JSON.parse(message);
    // Handle double-encoded: JSON.parse returns a string
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    return parsed as T;
  } catch {
    return null;
  }
}
