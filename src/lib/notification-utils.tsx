import { notifications } from "@mantine/notifications";
import { ReactNode } from "react";

interface NotificationWithProgressOptions {
  title: string;
  message: string;
  color?: string;
  autoClose?: number;
  withCloseButton?: boolean;
  icon?: ReactNode;
}

/**
 * Show a notification with an animated progress bar at the bottom
 */
export function showNotificationWithProgress({
  title,
  message,
  color = "blue",
  autoClose = 3000,
  withCloseButton = true,
  icon,
}: NotificationWithProgressOptions) {
  const id = notifications.show({
    title,
    message: (
      <div>
        <div style={{ marginBottom: "0.75rem" }}>{message}</div>
        <div
          style={{
            position: "absolute",
            bottom: "0.5rem",
            left: 0,
            right: 0,
            height: "5px",
            background: "var(--mantine-color-gray-3)",
            overflow: "hidden",
            borderRadius: "2px",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "var(--mantine-color-blue-filled)",
              animation: `notification-progress ${autoClose}ms linear`,
              transformOrigin: "left",
            }}
          />
        </div>
      </div>
    ),
    color,
    autoClose,
    withCloseButton,
    icon,
    styles: {
      root: {
        paddingBottom: "1.5rem",
      },
      description: {
        paddingBottom: "1.25rem",
      },
    },
  });

  // Inject keyframes if not already present
  if (typeof document !== "undefined") {
    const styleId = "notification-progress-keyframes";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @keyframes notification-progress {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  return id;
}
