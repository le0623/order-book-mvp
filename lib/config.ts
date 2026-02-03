/**
 * Configuration for API and WebSocket URLs
 * Supports dev mode for local backend development
 */

const isDevMode =
    process.env.NEXT_PUBLIC_DEV_MODE;
console.log("isDevMode", isDevMode);

// Local backend URLs (dev mode)
const LOCAL_API_URL = "http://127.0.0.1:8000";
const LOCAL_WS_URL = "ws://127.0.0.1:8000/ws";

// Production URLs
const PROD_API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.subnet118.com";
const PROD_WS_URL = process.env.NEXT_PUBLIC_WS_URL || "wss://api.subnet118.com/ws";

// Export URLs based on mode
export const API_URL = isDevMode ? LOCAL_API_URL : PROD_API_URL;
export const WS_BASE_URL = isDevMode ? LOCAL_WS_URL : PROD_WS_URL;

// Helper function to get WebSocket URL for /book endpoint
export const getWebSocketBookUrl = (): string => {
    const normalized = WS_BASE_URL.replace(/\/book\/?$/, "");
    return `${normalized}/book`;
};

// Helper function to get WebSocket URL for /price endpoint
export const getWebSocketPriceUrl = (): string => {
    const normalized = WS_BASE_URL.replace(/\/book\/?$/, "").replace(/\/price\/?$/, "");
    return `${normalized}/price`;
};

// Export dev mode status for debugging
export const DEV_MODE = isDevMode;

// Log configuration on client side (for debugging)
if (typeof window !== "undefined") {
    console.log(`[Config] Dev Mode: ${isDevMode}`);
    console.log(`[Config] API URL: ${API_URL}`);
    console.log(`[Config] WebSocket URL: ${WS_BASE_URL}`);
}

