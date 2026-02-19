"use client";

import React, { useEffect, useRef, useMemo } from "react";

/**
 * Greek letters from the TAO ecosystem plus core exchange terminology.
 */
const PIXEL_SYMBOLS = [
  "α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ",
  "λ", "μ", "ν", "ξ", "ο", "π", "ρ", "σ", "τ", "υ",
  "φ", "χ", "ψ", "ω", "Ω", "Δ", "Σ", "Φ", "Ψ", "Γ",
  "TAO", "HODL", "α/τ", "BID", "ASK",
];

interface FloatingSymbol {
  symbol: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  driftX: number;
  driftY: number;
  phase: number;
  duration: number;
  delay: number;
}

/**
 * Simple seeded PRNG for deterministic but well-distributed values.
 * Reason: Modular arithmetic with primes created correlated streaks;
 * this mulberry32-based approach gives uniform coverage across the viewport.
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates symbols using a jittered grid approach for full, even coverage.
 * The viewport is divided into cells, and each symbol is placed randomly
 * within its cell. This guarantees full background coverage while still
 * feeling organic and scattered.
 */
function generateSymbols(cols: number, rows: number): FloatingSymbol[] {
  const symbols: FloatingSymbol[] = [];
  const rand = seededRandom(42);
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  let idx = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Reason: Place within cell with jitter (60-90% of cell size) for organic scatter
      const jitterX = cellW * (0.05 + rand() * 0.9);
      const jitterY = cellH * (0.05 + rand() * 0.9);

      const r1 = rand();
      const r2 = rand();
      const r3 = rand();

      symbols.push({
        symbol: PIXEL_SYMBOLS[idx % PIXEL_SYMBOLS.length],
        x: col * cellW + jitterX,
        y: row * cellH + jitterY,
        size: 12 + Math.floor(r1 * 5) * 2, // 12px - 20px
        opacity: 0.06 + r2 * 0.05, // 0.06 - 0.11
        driftX: (r3 * 60) - 30, // -30px to +30px
        driftY: -20 - (rand() * 40), // -20px to -60px
        phase: rand() * Math.PI * 2,
        duration: 15 + rand() * 25, // 15s - 40s
        delay: -(rand() * 20), // stagger
      });
      idx++;
    }
  }
  return symbols;
}

/**
 * PixelSymbolsBackground renders randomly scattered, slowly animated 8-bit
 * styled subnet token symbols across the page background.
 *
 * Features:
 * - Geist Pixel Circle font for authentic 8-bit look
 * - Subtle floating/drifting animations
 * - Mouse proximity trail effect with slow fade
 * - Organic random placement (not a grid)
 */
export const PixelSymbolsBackground = React.memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePosition = useRef({ x: -1000, y: -1000 });

  // Reason: 14 cols x 12 rows = 168 symbols with full even coverage
  const symbols = useMemo(() => generateSymbols(14, 12), []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("mousemove", handleMouseMove);

    const elements = containerRef.current?.querySelectorAll<HTMLDivElement>(".pixel-sym");
    if (!elements || elements.length === 0) return;

    // Reason: Track per-element current opacity for smooth trail decay
    const currentOpacities = symbols.map((s) => s.opacity);

    let animationFrameId: number;

    const animate = () => {
      const mx = mousePosition.current.x;
      const my = mousePosition.current.y;

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const rect = el.getBoundingClientRect();
        const elX = rect.left + rect.width / 2;
        const elY = rect.top + rect.height / 2;

        const dx = elX - mx;
        const dy = elY - my;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const maxDist = 170;
        const baseOpacity = symbols[i]?.opacity ?? 0.07;

        // Reason: Mouse proximity target — closer = brighter, power curve for soft falloff
        const mouseTarget = distance < maxDist
          ? baseOpacity + 0.25 * Math.pow(1 - distance / maxDist, 1.4)
          : baseOpacity;

        const current = currentOpacities[i];

        // Reason: Fast attack so symbols light up instantly, slow decay for lingering trail
        const speed = mouseTarget > current ? 0.15 : 0.01;
        currentOpacities[i] += (mouseTarget - current) * speed;

        el.style.opacity = `${currentOpacities[i]}`;
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [symbols]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {symbols.map((sym, i) => (
        <div
          key={i}
          className="pixel-sym absolute font-[family-name:var(--font-geist-pixel-circle)] text-slate-400 dark:text-slate-400 select-none"
          style={{
            left: `${sym.x}%`,
            top: `${sym.y}%`,
            fontSize: `${sym.size}px`,
            opacity: sym.opacity,
            animation: `pixelFloat ${sym.duration}s ease-in-out ${sym.delay}s infinite`,
            ["--drift-x" as string]: `${sym.driftX}px`,
            ["--drift-y" as string]: `${sym.driftY}px`,
          }}
        >
          {sym.symbol}
        </div>
      ))}
    </div>
  );
});

PixelSymbolsBackground.displayName = "PixelSymbolsBackground";
