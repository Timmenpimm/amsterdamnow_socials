import "server-only";

export const FETCH_TIMEOUT_MS = 8000;

export function withTimeout(ms: number = FETCH_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

export function describeFetchError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "The request timed out. Check the URL and try again.";
    }
    return error.message;
  }
  return "Could not reach the server.";
}
