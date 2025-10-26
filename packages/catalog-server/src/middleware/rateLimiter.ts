/**
 * Rate Limiter Middleware
 *
 * Provides tiered rate limiting to prevent denial-of-service attacks
 * and abuse of expensive operations.
 */

import rateLimit from "express-rate-limit";

/**
 * Strict rate limiter for expensive operations
 * - Downloads, archives, imports, large file operations
 * - 10 requests per minute per IP
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window
  message: {
    error: "Too many requests from this IP, please try again after a minute",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful responses from counting against the limit in some cases
  skipSuccessfulRequests: false,
});

/**
 * Moderate rate limiter for data mutations
 * - POST, PUT, PATCH, DELETE operations
 * - 100 requests per minute per IP
 */
export const moderateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  message: {
    error: "Too many requests from this IP, please try again after a minute",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Relaxed rate limiter for read operations
 * - GET requests for data retrieval
 * - 500 requests per minute per IP
 */
export const relaxedLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500, // 500 requests per window
  message: {
    error: "Too many requests from this IP, please try again after a minute",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Global fallback rate limiter
 * - Applied to all routes as a safety net
 * - 1000 requests per minute per IP
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per window
  message: {
    error: "Too many requests from this IP, please slow down",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Very strict limiter for file uploads
 * - Archive imports, large uploads
 * - 5 requests per 5 minutes per IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 requests per window
  message: {
    error: "Too many upload requests from this IP, please try again later",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});
