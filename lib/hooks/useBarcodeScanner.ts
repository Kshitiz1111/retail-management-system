"use client";

import { useEffect, useCallback } from "react";

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

/**
 * Hook to detect barcode scanner input
 * Barcode scanners act as keyboards and send rapid keystrokes ending with Enter
 */
export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScannerOptions) {
  useEffect(() => {
    if (!enabled) return;

    let barcodeBuffer = "";
    let lastKeyTime = Date.now();
    const BARCODE_TIMEOUT = 100; // ms between keystrokes to consider it a barcode

    const handleKeyPress = (e: KeyboardEvent) => {
      const currentTime = Date.now();

      // Reset buffer if too much time passed (not a barcode scan)
      if (currentTime - lastKeyTime > BARCODE_TIMEOUT) {
        barcodeBuffer = "";
      }

      lastKeyTime = currentTime;

      // Handle Enter key (end of barcode)
      if (e.key === "Enter") {
        if (barcodeBuffer.length > 0) {
          onScan(barcodeBuffer.trim());
          barcodeBuffer = "";
        }
        return;
      }

      // Ignore special keys
      if (e.key.length > 1) {
        return;
      }

      // Add character to buffer
      barcodeBuffer += e.key;
    };

    window.addEventListener("keydown", handleKeyPress);

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [onScan, enabled]);
}

