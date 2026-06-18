import { ActionIcon, Badge, Select, Text } from "@mantine/core";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";
import React from "react";
import { useNavigate } from "react-router";
import { LIBRARY_STATUS_LABELS } from "../../constants/library";
import {
  useToggleFavorite,
  useUpdateLibraryItem,
} from "../../hooks/queries/useLibraryQueries";
import { formatRelativeTime } from "../../lib/date";
import { buildRoute } from "../../routes/routes.config";
import type { LibraryItem, LibraryStatus } from "../../types";
import { UnifiedMangaCard } from "../shared/UnifiedMangaCard";

interface LibraryCardProps {
  item: LibraryItem;
}

export const LibraryCard: React.FC<LibraryCardProps> = ({ item }) => {
  const navigate = useNavigate();
  const toggleFavorite = useToggleFavorite(item.id);
  const updateLibraryItem = useUpdateLibraryItem(item.id);

  const handleFavoriteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    toggleFavorite.mutate({ favorite: !item.favorite });
  };

  const handleStatusChange = (value: string | null) => {
    if (!value || value === item.status) return;
    updateLibraryItem.mutate({ status: value as LibraryStatus });
  };

  const handleCardClick = () => {
    navigate(buildRoute.mangaDetails(item.extensionId, item.mangaId));
  };

  const stopPropagation = (
    event:
      | React.MouseEvent
      | React.KeyboardEvent
      | React.TouchEvent
      | React.FocusEvent,
  ) => {
    event.stopPropagation();
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Select
        size="xs"
        value={item.status}
        allowDeselect={false}
        data={Object.entries(LIBRARY_STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
        onChange={handleStatusChange}
        disabled={updateLibraryItem.isPending}
        classNames={{
          input: "bg-white/10 border-white/20 text-white placeholder-white/60",
          dropdown: "bg-slate-900 text-white border border-white/10",
          option: "hover:bg-white/10",
        }}
        comboboxProps={{ withinPortal: true }}
        onClick={stopPropagation}
        onMouseDown={stopPropagation}
        onTouchStart={stopPropagation}
        radius="md"
        className="flex-1"
        style={{ minWidth: 0 }}
      />
      <ActionIcon
        variant="filled"
        color={item.favorite ? "red" : "gray"}
        size="sm"
        onClick={handleFavoriteClick}
        onMouseDown={stopPropagation}
        onTouchStart={stopPropagation}
        aria-label={
          item.favorite ? "Remove from favorites" : "Add to favorites"
        }
        className="shadow-md"
      >
        {item.favorite ? (
          <IconHeartFilled size={16} />
        ) : (
          <IconHeart size={16} />
        )}
      </ActionIcon>
    </div>
  );

  const footerContent = (
    <>
      <div className="mb-2 flex flex-wrap gap-2 text-xs text-white/80">
        <Badge
          size="xs"
          variant="light"
          color="dark"
          className="bg-white/10 text-[10px] tracking-wide uppercase"
        >
          {item.extensionId}
        </Badge>
        {item.favorite && (
          <Badge size="xs" color="red" variant="light">
            Favorite
          </Badge>
        )}
      </div>
      <Text size="xs" c="white" className="text-white/70">
        Updated {formatRelativeTime(item.lastUpdated)}
      </Text>
    </>
  );

  return (
    <UnifiedMangaCard
      id={item.mangaId}
      extensionId={item.extensionId}
      title={item.title}
      coverUrl={item.coverUrl}
      extensionName={item.extensionId}
      headerActions={headerActions}
      footerContent={footerContent}
      onCardClick={handleCardClick}
      onDetailsClick={handleCardClick}
    />
  );
};
