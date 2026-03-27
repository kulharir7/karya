/**
 * Karya Workflow Utilities
 * 
 * Helpers for robust workflow execution:
 * - Retry with exponential backoff
 * - Timeout wrapper
 * - Error recovery
 */

import { logger } from "./logger";

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: Error) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: () => true,
};

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      if (!opts.retryableErrors(lastError)) {
        throw lastError;
      }
      
      // Last attempt, don't delay
      if (attempt === opts.maxAttempts) {
        break;
      }
      
      logger.warn("workflow-retry", `Attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delay}ms`, lastError.message);
      
      // Wait before retry
      await sleep(delay);
      
      // Exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Wrap a function with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage = "Operation timed out"
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Wrap a function with both retry and timeout
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  options: RetryOptions & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 30000, ...retryOptions } = options;
  
  return withRetry(
    () => withTimeout(fn, timeoutMs),
    retryOptions
  );
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is a network error (should retry)
 */
export function isNetworkError(error: Error): boolean {
  const networkPatterns = [
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ENETUNREACH",
    "EAI_AGAIN",
    "socket hang up",
    "network",
    "timeout",
    "rate limit",
    "429",
    "503",
    "502",
  ];
  
  const message = error.message.toLowerCase();
  return networkPatterns.some(pattern => message.includes(pattern.toLowerCase()));
}

/**
 * Create a step executor with retry
 */
export function createRetryableExecutor<TInput, TOutput>(
  executor: (input: TInput) => Promise<TOutput>,
  options: RetryOptions = {}
): (input: TInput) => Promise<TOutput> {
  return (input: TInput) => withRetry(() => executor(input), {
    ...options,
    retryableErrors: options.retryableErrors || isNetworkError,
  });
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Truncate string for logging
 */
export function truncate(str: string, maxLength: number = 100): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
