"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface LoadingScreenProps {
  /** Minimum display time in ms before allowing fade-out */
  minDisplayTime?: number;
  /** Whether the app content is ready */
  isReady?: boolean;
  /** Callback when loading screen has fully exited */
  onComplete?: () => void;
}

export function LoadingScreen({
  minDisplayTime = 2400,
  isReady = false,
  onComplete,
}: LoadingScreenProps) {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [progress, setProgress] = useState(0);

  // Minimum display timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDisplayTime);
    return () => clearTimeout(timer);
  }, [minDisplayTime]);

  // Animate progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) {
          clearInterval(interval);
          return prev;
        }
        // Fast start, slow towards the end
        const increment = prev < 60 ? 3 : prev < 80 ? 1.5 : 0.5;
        return Math.min(prev + increment, 92);
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Trigger fade-out when both conditions are met
  useEffect(() => {
    if (minTimeElapsed && isReady) {
      setProgress(100);
      const fadeTimer = setTimeout(() => {
        setFadeOut(true);
      }, 300);
      return () => clearTimeout(fadeTimer);
    }
  }, [minTimeElapsed, isReady]);

  // Remove from DOM after fade animation completes
  useEffect(() => {
    if (fadeOut) {
      const removeTimer = setTimeout(() => {
        setHidden(true);
        onComplete?.();
      }, 700);
      return () => clearTimeout(removeTimer);
    }
  }, [fadeOut, onComplete]);

  if (hidden) return null;

  return (
    <div
      className={`loading-screen fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[hsl(207,23%,12%)] transition-opacity duration-700 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Scan lines overlay */}
      <div className="loading-scanlines" />

      {/* Ambient glow behind logo */}
      <div className="loading-ambient-glow" />

      {/* Grid pattern background */}
      <div className="loading-grid" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Diamond logo with glow */}
        <div className="loading-logo-container">
          <div className="loading-logo-glow" />
          <div className="loading-logo-ring" />
          <Image
            src="/hodl-logo.png"
            alt="HODL Exchange"
            width={120}
            height={120}
            className="loading-logo relative z-10"
            priority
          />
        </div>

        {/* Title */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <h1 className="text-[22px] font-normal tracking-tight text-white font-[family-name:var(--font-pixel)] loading-title">
            HODL<span className="ml-2.5">Exchange</span>
          </h1>
          <p className="text-[11px] font-medium tracking-[0.25em] uppercase text-blue-400/80 loading-subtitle">
            Powered by Subnet 118
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-64 mt-4">
          <div className="loading-progress-track">
            <div
              className="loading-progress-bar"
              style={{ width: `${progress}%` }}
            />
            <div className="loading-progress-shine" />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[9px] font-[family-name:var(--font-pixel)] text-blue-400/60 loading-status-text">
              {progress < 30
                ? "Connecting..."
                : progress < 60
                ? "Loading orders..."
                : progress < 90
                ? "Syncing data..."
                : progress < 100
                ? "Almost ready..."
                : "Ready"}
            </span>
            <span className="text-[9px] font-[family-name:var(--font-pixel)] text-blue-400/60">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>

      {/* Bottom decoration */}
      <div className="absolute bottom-8 flex flex-col items-center gap-2 z-10">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="loading-dot"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
