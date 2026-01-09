"use client";

import { Wallet } from "lucide-react";
import { useEffect } from "react";

export const ConnectButton = () => {
  useEffect(() => {
    // Add custom styles to appkit-button
    const style = document.createElement("style");
    style.textContent = `
      appkit-button {
        --wui-color-accent-100: transparent !important;
      }
      appkit-button button {
        background: transparent !important;
        border: 1px solid hsl(var(--border)) !important;
        border-radius: 0.5rem !important;
        padding: 0.5rem 1rem !important;
        transition: all 0.2s !important;
        display: flex !important;
        align-items: center !important;
        gap: 0.5rem !important;
      }
      appkit-button button:hover {
        background: hsl(var(--accent)) !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="px-2.5 py-1.5 gap-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500 border border-primary/20"></div>
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </div>
      {/* <appkit-button /> */}
    </div>
  );
};
