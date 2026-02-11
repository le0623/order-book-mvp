const isDevMode =
    process.env.NEXT_PUBLIC_DEV_MODE;

const LOCAL_API_URL = "http://127.0.0.1:8000";
const LOCAL_WS_URL = "ws://127.0.0.1:8000/ws";

const PROD_API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.subnet118.com";
const PROD_WS_URL = process.env.NEXT_PUBLIC_WS_URL || "wss://api.subnet118.com/ws";

export const API_URL = isDevMode ? LOCAL_API_URL : PROD_API_URL;
export const WS_BASE_URL = isDevMode ? LOCAL_WS_URL : PROD_WS_URL;

export const getWebSocketBookUrl = (): string => {
    const normalized = WS_BASE_URL.replace(/\/book\/?$/, "");
    return `${normalized}/book`;
};

export const getWebSocketPriceUrl = (): string => {
    const normalized = WS_BASE_URL.replace(/\/book\/?$/, "").replace(/\/price\/?$/, "");
    return `${normalized}/price`;
};

export const getWebSocketTapUrl = (): string => {
    const normalized = WS_BASE_URL.replace(/\/book\/?$/, "").replace(/\/tap\/?$/, "");
    return `${normalized}/tap`;
};

export const DEV_MODE = isDevMode;

if (typeof window !== "undefined") {
    console.log(`[Config] Dev Mode: ${isDevMode}`);
    console.log(`[Config] API URL: ${API_URL}`);
    console.log(`[Config] WebSocket URL: ${WS_BASE_URL}`);
}

