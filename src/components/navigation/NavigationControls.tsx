import React from 'react';
import { ActionIcon } from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconRefresh } from '@tabler/icons-react';
import { useNavigate } from 'react-router';

/**
 * Browser-style navigation controls (Back, Forward, Refresh)
 * Displays in the header for easy navigation
 */
export const NavigationControls: React.FC = () => {
  const navigate = useNavigate();
  const [canGoBack, setCanGoBack] = React.useState(false);

  // Check navigation history on mount and after navigation
  React.useEffect(() => {
    // Check if we can go back (history length > 1)
    setCanGoBack(window.history.length > 1);
  }, []);

  const handleBack = () => {
    if (canGoBack) {
      navigate(-1);
    }
  };

  const handleForward = () => {
    navigate(1);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-1">
      <ActionIcon
        variant="subtle"
        color="gray"
        size="md"
        onClick={handleBack}
        disabled={!canGoBack}
        aria-label="Go back"
        className="hover:bg-[var(--mantine-color-default-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ color: "var(--mantine-color-text)" }}
      >
        <IconArrowLeft size={18} stroke={1.5} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        color="gray"
        size="md"
        onClick={handleForward}
        aria-label="Go forward"
        className="hover:bg-[var(--mantine-color-default-hover)]"
        style={{ color: "var(--mantine-color-text)" }}
      >
        <IconArrowRight size={18} stroke={1.5} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        color="gray"
        size="md"
        onClick={handleRefresh}
        aria-label="Refresh page"
        className="hover:bg-[var(--mantine-color-default-hover)]"
        style={{ color: "var(--mantine-color-text)" }}
      >
        <IconRefresh size={18} stroke={1.5} />
      </ActionIcon>
    </div>
  );
};
