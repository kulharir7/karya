/**
 * Stagehand Browser Manager — Manages browser instance lifecycle
 * 
 * Phase 8.4: Added proper error handling, availability check, graceful fallback.
 * 
 * Stagehand may fail to init because:
 * - Chromium not installed
 * - No API key for LLM vision
 * - Port conflict
 * - Insufficient memory
 * 
 * Every browser tool should call getStagehand() in a try/catch.
 * Use isBrowserAvailable() for quick pre-check.
 */

import { Stagehand } from "@browserbasehq/stagehand";

let stagehandInstance: Stagehand | null = null;
let initFailed = false;
let lastError: string | null = null;

/**
 * Get or create Stagehand browser instance.
 * Throws on failure — caller MUST wrap in try/catch.
 */
export async function getStagehand(): Promise<Stagehand> {
  if (stagehandInstance) return stagehandInstance;

  // Don't retry if already failed (until reset)
  if (initFailed) {
    throw new Error(`Browser unavailable: ${lastError || "previous init failed"}. Use web-search as alternative.`);
  }

  try {
    // @ts-ignore - Stagehand API may vary between versions
    stagehandInstance = new Stagehand({
      env: "LOCAL",
      verbose: 0,
      localBrowserLaunchOptions: {
        headless: false,
      },
    });
    await stagehandInstance.init();
    lastError = null;
    return stagehandInstance;
  } catch (err: any) {
    initFailed = true;
    lastError = err.message || "Failed to initialize browser";
    stagehandInstance = null;
    throw new Error(`Browser init failed: ${lastError}. Try web-search instead.`);
  }
}

/**
 * Check if browser is available without trying to init.
 */
export function isBrowserAvailable(): boolean {
  return stagehandInstance !== null && !initFailed;
}

/**
 * Get browser status info.
 */
export function getBrowserStatus(): {
  available: boolean;
  initialized: boolean;
  failed: boolean;
  error: string | null;
} {
  return {
    available: stagehandInstance !== null,
    initialized: stagehandInstance !== null,
    failed: initFailed,
    error: lastError,
  };
}

/**
 * Reset browser state — allows retry after failure.
 */
export async function resetBrowser(): Promise<void> {
  if (stagehandInstance) {
    try { await stagehandInstance.close(); } catch { }
    stagehandInstance = null;
  }
  initFailed = false;
  lastError = null;
}

/**
 * Close browser gracefully.
 */
export async function closeStagehand(): Promise<void> {
  if (stagehandInstance) {
    try { await stagehandInstance.close(); } catch { }
    stagehandInstance = null;
  }
}
