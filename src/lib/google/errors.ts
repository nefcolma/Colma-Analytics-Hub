import type { ReportError } from "../types";

export function errorFromStatus(status: number, context: string): ReportError {
  if (status === 401) {
    return {
      code: "expired",
      message: "Google authorization expired. Reconnect your Google account.",
      retryable: false,
    };
  }
  if (status === 403) {
    return {
      code: "permission",
      message: `Permission denied while ${context}. Check that the Analytics APIs are enabled and your account has access.`,
      retryable: false,
    };
  }
  if (status === 404) {
    return { code: "not_found", message: `Not found while ${context}.`, retryable: false };
  }
  if (status === 429) {
    return {
      code: "quota",
      message: "Google Analytics API quota exceeded. Try again in a few minutes.",
      retryable: true,
    };
  }
  if (status >= 500) {
    return {
      code: "network",
      message: `Google returned a temporary error (${status}) while ${context}.`,
      retryable: true,
    };
  }
  return { code: "unknown", message: `Request failed (${status}) while ${context}.`, retryable: false };
}

export class GoogleApiError extends Error {
  constructor(public detail: ReportError) {
    super(detail.message);
    this.name = "GoogleApiError";
  }
}
