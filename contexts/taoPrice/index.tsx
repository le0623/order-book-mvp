"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";

// Pyth feed ID for Bittensor (TAO/USD)
const TAO_PRICE_FEED_ID =
  "410f41de235f2db824e562ea7ab2d3d3d4ff048316c61d629c0b93f58584e1af";

const PYTH_HERMES_URL = `https://hermes.pyth.network/v2/updates/price/stream?ids%5B%5D=${TAO_PRICE_FEED_ID}`;

const RECONNECT_DELAY_MS = 3000;

interface TaoPriceContextValue {
  /** Current TAO/USD price, or null if not yet received */
  price: number | null;
  /** True until the first price arrives */
  loading: boolean;
  /** Error message — only set if SSE fails AND no cached price exists */
  error: string | null;
}

const TaoPriceContext = createContext<TaoPriceContextValue>({
  price: null,
  loading: true,
  error: null,
});

/**
 * Provider that opens a single EventSource to Pyth Hermes for TAO/USD price.
 * Wraps the app layout so every component shares one SSE connection.
 *
 * - Direct browser → Pyth (no proxy, no API key, public endpoint)
 * - Auto-reconnects after 3 seconds on disconnect
 * - Keeps displaying last known price if connection drops
 */
export function TaoPriceProvider({ children }: { children: ReactNode }) {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Reason: Prevent duplicate connections
    if (eventSourceRef.current) return;

    try {
      const es = new EventSource(PYTH_HERMES_URL);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const priceInfo = data.parsed?.[0]?.price;
          if (!priceInfo) return;

          const actualPrice =
            Number(priceInfo.price) * Math.pow(10, priceInfo.expo);

          if (!isNaN(actualPrice) && actualPrice > 0) {
            setPrice(actualPrice);
            setLoading(false);
            setError(null);
          }
        } catch {
          // Malformed message — ignore, keep last known price
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        // Reason: Only show error if we have no cached price yet
        setPrice((prev) => {
          if (prev === null) {
            setError("Connection to price feed lost");
          }
          return prev;
        });

        // Auto-reconnect after delay
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, RECONNECT_DELAY_MS);
      };
    } catch {
      setError("Failed to connect to price feed");
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connect]);

  return (
    <TaoPriceContext.Provider value={{ price, loading, error }}>
      {children}
    </TaoPriceContext.Provider>
  );
}

/**
 * Hook to consume the TAO/USD price from the shared SSE context.
 *
 * Returns:
 *   { price, loading, error }
 */
export function useTaoPrice() {
  return useContext(TaoPriceContext);
}
