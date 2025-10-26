"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Global errors must use console as the logger might not be available
    // eslint-disable-next-line no-console
    console.error("Global error boundary caught unhandled error:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "2rem", marginBottom: "1rem", fontWeight: 600 }}>
            Application Error
          </h1>
          <p style={{ color: "#666", marginBottom: "2rem", maxWidth: "500px" }}>
            JAMRA encountered a critical error and could not recover. Please try
            refreshing the page or contact support if the issue persists.
          </p>
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                fontWeight: 500,
                color: "#fff",
                backgroundColor: "#2563eb",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.href = "/"}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                fontWeight: 500,
                color: "#374151",
                backgroundColor: "#e5e7eb",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
              }}
            >
              Go to home
            </button>
          </div>
          {error.digest && (
            <p style={{ marginTop: "2rem", fontSize: "0.875rem", color: "#9ca3af" }}>
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
