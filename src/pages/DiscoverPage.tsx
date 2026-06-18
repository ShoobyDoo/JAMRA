import { Tabs, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconAlertCircle, IconSearch } from "@tabler/icons-react";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { ExtensionBrowsePanel } from "../components/discover/ExtensionBrowsePanel";
import { EmptyState } from "../components/shared/EmptyState";
import { PageLoader } from "../components/shared/PageLoader";
import { useExtensionsList } from "../hooks/queries/useExtensionsQueries";

const ALL_SOURCES_TAB = "all";

export const DiscoverPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize query from URL params if searchAll=1
  const queryParam = searchParams.get("q");
  const searchAllParam = searchParams.get("searchAll");
  const initialQuery =
    searchAllParam === "1" && queryParam ? decodeURIComponent(queryParam) : "";

  const [allSourcesQuery, setAllSourcesQuery] = useState(initialQuery);
  const [debouncedAllSourcesQuery] = useDebouncedValue(allSourcesQuery, 350);

  // Re-sync allSourcesQuery whenever a new header search arrives, even when
  // DiscoverPage is already mounted (the route has no dynamic segment, so
  // React Router does not remount on query-string-only navigations). This is
  // a render-phase state adjustment (not inside an effect) per the React
  // pattern for "adjusting state when a prop/param changes" — using state
  // (not a ref) to track the last-synced param, since refs can't be read or
  // written during render.
  const [lastSyncedQuery, setLastSyncedQuery] = useState(
    searchAllParam === "1" ? queryParam : null,
  );
  if (
    searchAllParam === "1" &&
    queryParam &&
    queryParam !== lastSyncedQuery
  ) {
    setLastSyncedQuery(queryParam);
    setAllSourcesQuery(decodeURIComponent(queryParam));
  }

  const { data: extensionsData, isLoading: isLoadingExtensions } =
    useExtensionsList();

  const extensions = extensionsData?.extensions ?? [];

  const activeTab = searchParams.get("tab") || ALL_SOURCES_TAB;

  // Set active tab to "All sources" when searchAll=1 and sync query params
  useEffect(() => {
    if (searchAllParam === "1") {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", ALL_SOURCES_TAB);
          return next;
        },
        { replace: true },
      );
    }
  }, [searchAllParam, setSearchParams]);

  const handleTabChange = (value: string | null) => {
    if (!value) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <section className="mb-8 text-center">
        <Title order={1} className="mb-3">
          Discover
        </Title>
        <Text className="mx-auto mb-6 max-w-2xl text-gray-600">
          Search across your installed extensions to find manga, or explore
          what's popular right now.
        </Text>
      </section>

      {isLoadingExtensions ? (
        <PageLoader />
      ) : extensions.length === 0 ? (
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
        <Tabs value={activeTab} onChange={handleTabChange} keepMounted={false}>
          <Tabs.List className="mb-6">
            <Tabs.Tab value={ALL_SOURCES_TAB}>All sources</Tabs.Tab>
            {extensions.map((extension) => (
              <Tabs.Tab key={extension.id} value={extension.id}>
                {extension.name}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          <Tabs.Panel value={ALL_SOURCES_TAB}>
            <TextInput
              value={allSourcesQuery}
              onChange={(event) =>
                setAllSourcesQuery(event.currentTarget.value)
              }
              placeholder="Search across all installed extensions"
              radius="md"
              size="md"
              leftSection={<IconSearch size={18} />}
              className="mb-8"
              aria-label="Search across all installed extensions"
            />

            <div className="space-y-10">
              {extensions.map((extension) => (
                <div key={extension.id}>
                  <Title order={3} className="mb-4">
                    {extension.name}
                  </Title>
                  <ExtensionBrowsePanel
                    extensionId={extension.id}
                    extensionName={extension.name}
                    externalQuery={debouncedAllSourcesQuery}
                  />
                </div>
              ))}
            </div>
          </Tabs.Panel>

          {extensions.map((extension) => (
            <Tabs.Panel key={extension.id} value={extension.id}>
              <ExtensionBrowsePanel
                extensionId={extension.id}
                extensionName={extension.name}
              />
            </Tabs.Panel>
          ))}
        </Tabs>
      )}
    </div>
  );
};
