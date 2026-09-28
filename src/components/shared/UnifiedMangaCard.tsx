import {
  ActionIcon,
  Badge,
  Card,
  Progress,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconBook } from "@tabler/icons-react";
import React, { type ReactNode } from "react";
import { useNavigate } from "react-router";
import { buildRoute } from "../../routes/routes.config";

interface UnifiedMangaCardProps {
  id: string;
  extensionId: string;
  title: string;
  coverUrl?: string;

  // Optional metadata
  extensionName?: string;
  status?: string;

  // Progress data (for library/continue reading)
  showProgress?: boolean;
  progressPercent?: number;
  currentChapter?: string | number;
  updatedAt?: string;

  // Actions
  onCardClick?: (id: string, extensionId: string) => void;
  onDetailsClick?: (id: string, extensionId: string) => void;
  headerActions?: ReactNode;
  footerContent?: ReactNode;
  showDetailsButton?: boolean;
}

export const UnifiedMangaCard: React.FC<UnifiedMangaCardProps> = ({
  id,
  extensionId,
  title,
  coverUrl,
  extensionName,
  status,
  showProgress = false,
  progressPercent,
  currentChapter,
  updatedAt,
  onCardClick,
  onDetailsClick,
  headerActions,
  footerContent,
  showDetailsButton = true,
}) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(id, extensionId);
    } else {
      navigate(buildRoute.mangaDetails(extensionId, id));
    }
  };

  const handleDetailsClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (onDetailsClick) {
      onDetailsClick(id, extensionId);
    } else {
      navigate(buildRoute.mangaDetails(extensionId, id));
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick();
    }
  };

  const clampedProgressPercent =
    progressPercent !== undefined
      ? Math.min(100, Math.max(0, progressPercent))
      : undefined;

  return (
    <Card
      padding={0}
      radius="lg"
      withBorder={false}
      style={{ aspectRatio: "2 / 3" }}
      className="group relative mx-auto w-full max-w-44 cursor-pointer overflow-hidden border border-white/10 bg-gray-900/30 text-white ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl sm:max-w-48"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View ${title}`}
    >
      {/* Background Cover Image */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-transform duration-500 ease-out group-hover:scale-105 ${
          coverUrl ? "" : "bg-linear-to-br from-gray-200 to-gray-400"
        }`}
        style={{
          backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20 transition-all duration-500 group-hover:bg-black/10" />

      {/* Top Section: Title + Details Button */}
      <div className="absolute inset-x-0 top-0 z-1 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.95)_0%,rgba(0,0,0,0.8)_20%,rgba(0,0,0,0.6)_40%,rgba(0,0,0,0.35)_60%,rgba(0,0,0,0.15)_80%,transparent_100%)] p-3 text-white">
        <div className="flex items-start gap-2">
          <Text
            fw={600}
            size="sm"
            c="white"
            className="flex-1 truncate break-all"
            title={title}
          >
            {title}
          </Text>
          {showDetailsButton && (
            <Tooltip label="Manga Details" withArrow position="bottom">
              <ActionIcon
                variant="filled"
                color="blue"
                size="md"
                radius="md"
                onClick={handleDetailsClick}
                aria-label="Open manga details"
                className="shadow-sm transition-transform duration-200 hover:scale-105"
              >
                <IconBook size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </div>
        {headerActions && <div className="mt-2">{headerActions}</div>}

        {/* Metadata: Extension name or status */}
        {(extensionName || status) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {extensionName && (
              <Badge
                size="xs"
                variant="filled"
                color="dark"
                className="bg-black/60 text-white shadow-sm backdrop-blur-sm"
              >
                {extensionName}
              </Badge>
            )}
            {status && (
              <Badge
                size="xs"
                variant="filled"
                color="blue"
                className="bg-blue-600/80 text-white shadow-sm backdrop-blur-sm"
              >
                {status}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Bottom Section: Progress (conditional) */}
      {(footerContent ||
        (showProgress && clampedProgressPercent !== undefined)) && (
        <div className="absolute inset-x-0 bottom-0 z-1 bg-[linear-gradient(to_top,rgba(0,0,0,0.95)_0%,rgba(0,0,0,0.85)_20%,rgba(0,0,0,0.65)_40%,rgba(0,0,0,0.4)_60%,rgba(0,0,0,0.15)_80%,transparent_100%)] p-3 text-white">
          {footerContent ?? (
            <>
              {currentChapter && (
                <Text
                  size="xs"
                  c="white"
                  fw={500}
                  className="mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                >
                  Chapter {currentChapter}
                </Text>
              )}
              <div className="mb-2 flex items-center justify-between text-xs tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                <span>Progress</span>
                <span>{clampedProgressPercent}%</span>
              </div>
              <Progress
                value={clampedProgressPercent ?? 0}
                size="sm"
                radius="xl"
                color="blue"
              />
              {updatedAt && (
                <div className="mt-2 text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  Updated {updatedAt}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
};
