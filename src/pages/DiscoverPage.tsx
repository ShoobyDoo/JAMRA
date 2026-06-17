import {
  Button,
  Divider,
  Group,
  MultiSelect,
  Paper,
  Select,
  SegmentedControl,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconFlame,
  IconSearch,
} from "@tabler/icons-react";
import React, { useState } from "react";
import { ExtensionSearchResults } from "../components/discover/ExtensionSearchResults";
import { EmptyState } from "../components/shared/EmptyState";
import { MangaCardGrid } from "../components/shared/MangaCardGrid";
import { PageLoader } from "../components/shared/PageLoader";
import { UnifiedMangaCard } from "../components/shared/UnifiedMangaCard";
import {
  useExtensionSearch,
  useExtensionsList,
} from "../hooks/queries/useExtensionsQueries";

type SearchMode = "single" | "all";

export const DiscoverPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("all");
  const [selectedExtension, setSelectedExtension] = useState<string | null>(
    null,
  );
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("relevance");

  const { data: extensionsData, isLoading: isLoadingExtensions } =
    useExtensionsList();
  const loadPopular = Boolean(extensionsData?.extensions?.length);

  // Single extension search
  const { data: singleSearchResults, isLoading: isSingleSearching } =
    useExtensionSearch(
      searchMode === "single" && selectedExtension
        ? selectedExtension
        : undefined,
      searchMode === "single" && searchQuery ? { query: searchQuery } : undefined,
    );

  // Multi-extension concurrent searches
  const allExtensionsToSearch =
    searchMode === "all"
      ? selectedExtensions.length > 0
        ? selectedExtensions
        : extensionsData?.extensions.map((e) => e.id) || []
      : [];

  // Get extension details for rendering
  const extensionsToRender =
    searchMode === "all" && searchQuery
      ? allExtensionsToSearch.map((extId) => ({
          id: extId,
          name:
            extensionsData?.extensions.find((e) => e.id === extId)?.name ||
            extId,
        }))
      : [];

  // Popular extensions
  const popularExtensions = loadPopular
    ? extensionsData?.extensions || []
    : [];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!query.trim()) {
      return;
    }

    if (searchMode === "single" && !selectedExtension) {
      return;
    }

    setSearchQuery(query);
  };

  const extensionOptions =
    extensionsData?.extensions.map((ext) => ({
      value: ext.id,
      label: ext.name,
    })) || [];

  const hasSearched = Boolean(searchQuery);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Header */}
      <section className="mb-8 text-center">
        <Title order={1} className="mb-3">
          Discover
        </Title>
        <Text className="mx-auto mb-6 max-w-2xl text-gray-600">
          Search across your installed extensions to find manga, or explore
          what's popular right now.
        </Text>

        {isLoadingExtensions ? (
          <PageLoader />
        ) : extensionOptions.length === 0 ? (
          <EmptyState
            icon={
              <IconAlertCircle
                size={28}
                style={{ color: "var(--mantine-color-yellow-6)" }}
              />
            }
            title="No Extensions Installed"
            description="You need to install extensions before you can search for manga. Visit the Extensions page to install one."
          />
        ) : (
          <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
            <Paper shadow="sm" radius="lg" className="border border-gray-200 p-4">
              {/* Search Mode Selector */}
              <SegmentedControl
                value={searchMode}
                onChange={(value) => setSearchMode(value as SearchMode)}
                data={[
                  { label: "Search All", value: "all" },
                  { label: "Single Extension", value: "single" },
                ]}
                fullWidth
                className="mb-4"
              />

              {/* Extension Selection */}
              {searchMode === "single" ? (
                <Select
                  value={selectedExtension}
                  onChange={setSelectedExtension}
                  data={extensionOptions}
                  placeholder="Select an extension"
                  searchable
                  clearable
                  size="md"
                  className="mb-3 w-full"
                  aria-label="Select extension"
                />
              ) : (
                <MultiSelect
                  value={selectedExtensions}
                  onChange={setSelectedExtensions}
                  data={extensionOptions}
                  placeholder="Select extensions (leave empty for all)"
                  searchable
                  clearable
                  size="md"
                  className="mb-3 w-full"
                  aria-label="Select extensions"
                />
              )}

              {/* Search Input + Filters */}
              <Group gap="md" className="mb-3">
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Search title or author"
                  radius="md"
                  size="md"
                  leftSection={<IconSearch size={18} />}
                  className="flex-1"
                />
                <Select
                  value={sortBy}
                  onChange={(value) => setSortBy(value || "relevance")}
                  data={[
                    { value: "relevance", label: "Relevance" },
                    { value: "latest", label: "Latest" },
                    { value: "popular", label: "Popular" },
                    { value: "alphabetical", label: "A-Z" },
                  ]}
                  placeholder="Sort by"
                  size="md"
                  className="w-40"
                  aria-label="Sort by"
                />
              </Group>

              <Button
                type="submit"
                radius="md"
                size="md"
                fullWidth
                disabled={
                  !query.trim() ||
                  (searchMode === "single" && !selectedExtension)
                }
                loading={searchMode === "single" && isSingleSearching}
                leftSection={<IconSearch size={18} />}
              >
                Search
              </Button>
            </Paper>
          </form>
        )}
      </section>

      {/* Search Results */}
      {hasSearched && (
        <>
          <Divider my="xl" />
          <section>
            <Title order={2} className="mb-6">
              <IconSearch size={24} className="mb-1 inline" /> Search Results
            </Title>

            {searchMode === "single" ? (
              // Single extension results
              <div>
                <Text size="sm" c="dimmed" className="mb-4">
                  Searching in:{" "}
                  {
                    extensionsData?.extensions.find(
                      (e) => e.id === selectedExtension,
                    )?.name
                  }{" "}
                  ({singleSearchResults?.results.length || 0} results)
                </Text>
                {isSingleSearching ? (
                  <PageLoader />
                ) : singleSearchResults && singleSearchResults.results.length > 0 ? (
                  <MangaCardGrid>
                    {singleSearchResults.results.map((manga) => (
                      <UnifiedMangaCard
                        key={manga.id}
                        id={manga.id}
                        extensionId={selectedExtension!}
                        title={manga.title}
                        coverUrl={manga.coverUrl}
                        status={manga.status}
                      />
                    ))}
                  </MangaCardGrid>
                ) : (
                  <EmptyState title={`No results found for "${searchQuery}"`} />
                )}
              </div>
            ) : (
              // Multi-extension grouped results
              <div className="space-y-8">
                {extensionsToRender.map((ext) => (
                  <ExtensionSearchResults
                    key={ext.id}
                    extensionId={ext.id}
                    extensionName={ext.name}
                    searchQuery={searchQuery}
                    showHeader={true}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Popular/Hot Section (shows when not searching) */}
      {!hasSearched && loadPopular && popularExtensions.length > 0 && (
        <>
          <Divider my="xl" />
          <section>
            <div className="mb-6 flex items-center gap-2">
              <IconFlame size={24} className="text-orange-500" />
              <Title order={2}>Popular & Trending</Title>
            </div>

            <div className="space-y-8">
              {popularExtensions.map((ext) => (
                <ExtensionSearchResults
                  key={ext.id}
                  extensionId={ext.id}
                  extensionName={ext.name}
                  searchQuery=""
                  limit={6}
                  showHeader={true}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
