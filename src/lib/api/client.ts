import { API_CONFIG } from "../constants";
import { logger } from "../logger";

const API_BASE =
  process.env.NEXT_PUBLIC_JAMRA_API_URL ??
  process.env.JAMRA_API_URL ??
  `${API_CONFIG.DEFAULT_URL}/api`;

function sanitizeErrorDetail(detail?: string | null): string | undefined {
  if (!detail) return undefined;
  const trimmed = detail.trim();
  if (!trimmed) return undefined;
  const withoutTags = trimmed.includes("<")
    ? trimmed
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : trimmed;
  return withoutTags.length > 0 ? withoutTags : undefined;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions extends RequestInit {
  allowStatuses?: number[];
}

export async function request<T>(
  path: string,
  init: ApiRequestOptions = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const { allowStatuses, ...fetchInit } = init;
  const method = fetchInit.method || "GET";
  const startTime = Date.now();

  logger.apiCall(url, method, {
    component: "API",
    action: "request",
    requestSize: fetchInit?.body ? JSON.stringify(fetchInit.body).length : 0,
  });

  try {
    const response = await fetch(url, {
      ...fetchInit,
      headers: {
        accept: "application/json",
        ...(fetchInit?.body ? { "content-type": "application/json" } : {}),
        ...(fetchInit?.headers ?? {}),
      },
      cache: "no-store",
    });

    const duration = Date.now() - startTime;
    const responseSize = Number(response.headers.get("content-length")) || 0;
    const isAllowedStatus =
      !response.ok && allowStatuses?.includes(response.status);

    if (isAllowedStatus) {
      logger.info(
        `API ${method} ${url} returned allowed status ${response.status}`,
        {
          component: "API",
          action: "allowed-status",
          url,
          method,
          statusCode: response.status,
          duration,
          responseSize,
        },
      );
    } else {
      logger.apiResponse(url, method, response.status, duration, {
        component: "API",
        action: "response",
        responseSize,
      });
    }

    if (!response.ok) {
      if (isAllowedStatus) {
        return undefined as T;
      }

      const detailText = await response.text().catch(() => undefined);
      const cleanedDetail = sanitizeErrorDetail(detailText);

      let userMessage = cleanedDetail || response.statusText;
      if (cleanedDetail) {
        try {
          const parsed = JSON.parse(detailText || "{}");
          if (parsed.detail && typeof parsed.detail === "string") {
            userMessage = parsed.detail;
          } else if (parsed.error && typeof parsed.error === "string") {
            userMessage = parsed.error;
          } else if (parsed.message && typeof parsed.message === "string") {
            userMessage = parsed.message;
          }
        } catch {
          // Not JSON
        }
      }

      logger.error(
        `API request failed: ${response.status} ${response.statusText}`,
        {
          component: "API",
          action: "error",
          url,
          method,
          statusCode: response.status,
          duration,
          error: new Error(userMessage),
        },
      );

      throw new ApiError(
        userMessage,
        response.status,
        response.statusText,
        cleanedDetail,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const responseData = (await response.json()) as T;

    logger.debug(`API response data received`, {
      component: "API",
      action: "data-received",
      url,
      method,
      dataSize: JSON.stringify(responseData).length,
    });

    return responseData;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (
      error instanceof Error &&
      "name" in error &&
      error.name === "AbortError"
    ) {
      logger.debug(`API request aborted: ${method} ${url}`, {
        component: "API",
        action: "abort",
        url,
        method,
        duration,
      });
      throw error;
    }

    if (error instanceof ApiError) {
      logger.apiError(url, method, error, duration, {
        component: "API",
        action: "api-error",
      });
    } else {
      logger.error(`Network or parsing error`, {
        component: "API",
        action: "network-error",
        url,
        method,
        duration,
        error: error as Error,
      });
    }

    throw error;
  }
}

export { API_BASE };
