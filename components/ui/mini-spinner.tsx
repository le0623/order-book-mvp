"use client";

import { cn } from "@/lib/utils";

interface MiniSpinnerProps {
  /** Diameter in pixels (default 12) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * iOS / SwiftUI-style activity indicator.
 *
 * Renders 8 radial bars with graduated opacity, rotated
 * in discrete steps for the classic "petal" look.
 */
export function MiniSpinner({ size = 12, className }: MiniSpinnerProps) {
  const segments = 8;
  const center = size / 2;
  const inner = size * 0.24;
  const outer = size * 0.46;
  const strokeWidth = Math.max(1.2, size * 0.11);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("mini-spinner", className)}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: segments }, (_, i) => {
        const angle = (i * 360) / segments - 90;
        const rad = (angle * Math.PI) / 180;
        const opacity = 0.12 + (i / (segments - 1)) * 0.88;

        return (
          <line
            key={i}
            x1={center + inner * Math.cos(rad)}
            y1={center + inner * Math.sin(rad)}
            x2={center + outer * Math.cos(rad)}
            y2={center + outer * Math.sin(rad)}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
}
