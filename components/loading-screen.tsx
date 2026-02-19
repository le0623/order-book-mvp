"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// Single messages get shuffled freely.
// Sequential groups (arrays) stay in order but their position in the list is randomized.
const SINGLE_MESSAGES = [
  "Accessing the Akashic Records...",
  "Computing magic numbers...",
  "Mining thermodynamics...",
  "Syncing man and machine...",
  "Ringing the monastery bells...",
  "Starlink upload requested...",
  "Consulting the oracle...",
  "Aligning the satellites...",
  "Waking up the validators...",
  "Summoning subnet wizards...",
  "Polishing the order book...",
  "Sharpening the algorithms...",
  "Tuning quantum frequencies...",
];

const SEQUENTIAL_GROUPS = [
  ["Priming rocket boosters 1/3...", "Priming rocket boosters 2/3...", "Priming rocket boosters 3/3..."],
];

const COMPLETION_MESSAGES = [
  "Blast off!",
  "All systems go!",
  "HODL!",
  "To the moon!",
  "We have liftoff!",
  "LFG!",
];

/** Fisher-Yates shuffle (non-mutating) */
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Builds a flat message list where single messages are shuffled
 * and sequential groups keep their internal order but are placed
 * at a random position among the singles.
 */
function buildMessageList(): string[] {
  const shuffledSingles = shuffleArray(SINGLE_MESSAGES);

  // Treat each group as one "slot" to place among the singles
  const slots: (string | string[])[] = [...shuffledSingles];
  for (const group of SEQUENTIAL_GROUPS) {
    const insertAt = Math.floor(Math.random() * (slots.length + 1));
    slots.splice(insertAt, 0, group);
  }

  // Flatten groups into the final list
  return slots.flat();
}

// Deterministic default for SSR (no randomness during render)
const DEFAULT_MESSAGES = [...SINGLE_MESSAGES, ...SEQUENTIAL_GROUPS.flat()];

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
  const [messageIndex, setMessageIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [messagesReady, setMessagesReady] = useState(false);
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [completionMessage, setCompletionMessage] = useState(COMPLETION_MESSAGES[0]);

  // Randomize messages on client mount only to avoid hydration mismatch
  useEffect(() => {
    setMessages(buildMessageList());
    setCompletionMessage(
      COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)]
    );
    setMessagesReady(true);
  }, []);

  // Cycle through loading messages, never repeating
  useEffect(() => {
    if (isComplete || !messagesReady) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => {
        const next = prev + 1;
        if (next >= messages.length) {
          clearInterval(interval);
          return prev;
        }
        return next;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [isComplete, messagesReady, messages.length]);

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
      setIsComplete(true);
      const fadeTimer = setTimeout(() => {
        setFadeOut(true);
      }, 600);
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
          <a
            href="https://taomarketcap.com/subnets/118"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium tracking-[0.25em] uppercase text-blue-400/80 loading-subtitle hover:text-blue-300 transition-colors"
          >
            Powered by Subnet 118
          </a>
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
          <div className="flex justify-between mt-2 items-center">
            {(messagesReady || isComplete) && (
              <span
                key={isComplete ? "done" : messageIndex}
                className={`text-[9px] font-[family-name:var(--font-pixel)] loading-message-cycle ${
                  isComplete
                    ? "text-emerald-400/90"
                    : "text-blue-400/60"
                }`}
              >
                {isComplete
                  ? completionMessage
                  : messages[messageIndex]}
              </span>
            )}
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
