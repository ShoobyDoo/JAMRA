"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  ManagedExtension,
  acknowledgeExtensionUpdate,
  checkExtensionUpdates,
  disableExtension,
  enableExtension,
  fetchExtensionMarketplace,
  fetchExtensions,
  installExtension,
  type ExtensionListOptions,
  type MarketplaceData,
  type MarketplaceExtensionSummary,
  uninstallExtension,
  updateExtensionSettings,
} from "@/lib/api";
import { compareVersions } from "@jamra/extension-registry";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowDown,
  ArrowUp,
  RefreshCcw,
} from "lucide-react";

const TRUST_WARNING = "Only install extensions that you trust.";

function resolveIcon(icon?: string | null): string | undefined {
  const trimmed = icon?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

type StatusFilter = "all" | "enabled" | "disabled";
type ExtensionTab = "installed" | "marketplace";

interface SettingsModalState {
  extension: ManagedExtension;
  value: string;
  error: string | null;
  saving: boolean;
}

interface MarketplaceInstallCandidate {
  extension: MarketplaceExtensionSummary;
  version: { version: string; releaseNotes: string };
}

export function ExtensionsManager({
  initialExtensions,
  initialQuery,
  initialError,
}: {
  initialExtensions: ManagedExtension[];
  initialQuery?: ExtensionListOptions;
  initialError?: string | null;
}) {
  const [extensions, setExtensions] =
    useState<ManagedExtension[]>(initialExtensions);
  const [search, setSearch] = useState(initialQuery?.search ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (initialQuery?.status as StatusFilter | undefined) ?? "all",
  );
  const [sort, setSort] = useState<NonNullable<ExtensionListOptions["sort"]>>(
    initialQuery?.sort ?? "name",
  );
  const [order, setOrder] = useState<
    NonNullable<ExtensionListOptions["order"]>
  >(initialQuery?.order ?? "asc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busyExtensionId, setBusyExtensionId] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installPath, setInstallPath] = useState("");
  const [autoEnable, setAutoEnable] = useState(true);
  const [installError, setInstallError] = useState<string | null>(null);
  const [settingsModal, setSettingsModal] = useState<SettingsModalState | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<ExtensionTab>("installed");
  const [marketplace, setMarketplace] = useState<MarketplaceData | null>(null);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [marketplaceInstallError, setMarketplaceInstallError] = useState<
    string | null
  >(null);
  const [marketplaceAutoEnable, setMarketplaceAutoEnable] = useState(true);
  const [marketplaceBusyId, setMarketplaceBusyId] = useState<string | null>(
    null,
  );
  const [installCandidate, setInstallCandidate] =
    useState<MarketplaceInstallCandidate | null>(null);
  const [uninstallTarget, setUninstallTarget] =
    useState<ManagedExtension | null>(null);

  const installCandidateIcon = installCandidate
    ? resolveIcon(installCandidate.extension.icon)
    : undefined;

  const [debouncedSearch] = useDebouncedValue(search, 300);
  const isFirstRender = useRef(true);

  const refreshExtensions = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const next = await fetchExtensions({
          search: debouncedSearch || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          sort,
          order,
        });
        setExtensions(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [debouncedSearch, statusFilter, sort, order],
  );

  const refreshMarketplace = useCallback(async () => {
    setMarketplaceLoading(true);
    setMarketplaceError(null);
    try {
      const data = await fetchExtensionMarketplace();
      setMarketplace(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("/api/extension-marketplace")) {
        setMarketplaceError(
          "Marketplace API is unavailable. Update or restart the catalog server to enable registry support.",
        );
      } else {
        setMarketplaceError(message);
      }
    } finally {
      setMarketplaceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void refreshExtensions();
  }, [refreshExtensions]);

  useEffect(() => {
    if (
      activeTab === "marketplace" &&
      !marketplace &&
      !marketplaceLoading &&
      !marketplaceError
    ) {
      void refreshMarketplace();
    }
  }, [
    activeTab,
    marketplace,
    marketplaceLoading,
    marketplaceError,
    refreshMarketplace,
  ]);

  const updateExtensionState = useCallback(
    (updated?: ManagedExtension) => {
      if (!updated) {
        void refreshExtensions(true);
        return;
      }
      setExtensions((prev) => {
        const idx = prev.findIndex((item) => item.id === updated.id);
        if (idx === -1) {
          return [updated, ...prev];
        }
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    },
    [refreshExtensions],
  );

  const handleInstallFromPath = async () => {
    if (!installPath.trim()) {
      setInstallError("Provide a path to the extension entry file.");
      return;
    }

    setInstalling(true);
    setInstallError(null);
    try {
      const extension = await installExtension({
        filePath: installPath.trim(),
        enabled: autoEnable,
      });
      updateExtensionState(extension);
      setInstallPath("");
      setAutoEnable(true);
      void refreshExtensions(true);
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  };

  const handleEnable = async (extension: ManagedExtension) => {
    setBusyExtensionId(extension.id);
    setError(null);
    try {
      const updated = await enableExtension(extension.id);
      updateExtensionState(updated);
      void refreshExtensions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyExtensionId(null);
    }
  };

  const handleDisable = async (extension: ManagedExtension) => {
    setBusyExtensionId(extension.id);
    setError(null);
    try {
      const updated = await disableExtension(extension.id);
      if (updated) {
        updateExtensionState(updated);
      }
      void refreshExtensions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyExtensionId(null);
    }
  };

  const requestUninstall = (extension: ManagedExtension) => {
    setUninstallTarget(extension);
  };

  const cancelUninstall = () => setUninstallTarget(null);

  const confirmUninstall = async () => {
    if (!uninstallTarget) return;

    setBusyExtensionId(uninstallTarget.id);
    setError(null);
    try {
      await uninstallExtension(uninstallTarget.id);
      setExtensions((prev) =>
        prev.filter((item) => item.id !== uninstallTarget.id),
      );
      setUninstallTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyExtensionId(null);
    }
  };

  const handleCheckUpdates = async (extension: ManagedExtension) => {
    if (!extension.source?.registryId) {
      setError(
        `${extension.name} was installed manually and cannot check for marketplace updates.`,
      );
      return;
    }
    setBusyExtensionId(extension.id);
    setError(null);
    try {
      const updated = await checkExtensionUpdates(extension.id);
      updateExtensionState(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("/api/extensions/")) {
        setError(
          `${extension.name} cannot check for updates because the catalog server does not expose the update endpoint yet.`,
        );
      } else {
        setError(message);
      }
    } finally {
      setBusyExtensionId(null);
    }
  };

  const handleAcknowledgeUpdate = async (extension: ManagedExtension) => {
    const latest = extension.updateState?.latest;
    if (!latest) return;
    setBusyExtensionId(extension.id);
    setError(null);
    try {
      const updated = await acknowledgeExtensionUpdate(
        extension.id,
        latest.version,
      );
      updateExtensionState(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyExtensionId(null);
    }
  };

  const handleApplyUpdate = async (extension: ManagedExtension) => {
    const latest = extension.updateState?.latest;
    const registryId = extension.source?.registryId;
    if (!latest || !registryId) {
      setError(`${extension.name} does not provide marketplace updates.`);
      return;
    }

    setBusyExtensionId(extension.id);
    setError(null);
    try {
      const updated = await installExtension({
        source: {
          registryId,
          extensionId: extension.id,
          version: latest.version,
        },
        enabled: extension.enabled,
      });
      updateExtensionState(updated);
      void refreshExtensions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyExtensionId(null);
    }
  };

  const openSettingsModal = (extension: ManagedExtension) => {
    setSettingsModal({
      extension,
      value: JSON.stringify(extension.settings ?? {}, null, 2),
      error: null,
      saving: false,
    });
  };

  const closeSettingsModal = () => setSettingsModal(null);

  const saveSettings = async () => {
    if (!settingsModal) return;

    let parsed: Record<string, unknown> | null;
    try {
      const trimmed = settingsModal.value.trim();
      if (trimmed.length === 0) {
        parsed = null;
      } else {
        parsed = JSON.parse(settingsModal.value) as Record<string, unknown>;
      }
    } catch {
      setSettingsModal((current) =>
        current
          ? { ...current, error: "Settings must be valid JSON." }
          : current,
      );
      return;
    }

    setSettingsModal((current) =>
      current ? { ...current, saving: true, error: null } : current,
    );
    try {
      const updated = await updateExtensionSettings(
        settingsModal.extension.id,
        parsed,
      );
      updateExtensionState(updated);
      closeSettingsModal();
    } catch (err) {
      setSettingsModal((current) =>
        current
          ? {
              ...current,
              saving: false,
              error: err instanceof Error ? err.message : String(err),
            }
          : current,
      );
    }
  };

  const statusSummary = useMemo(() => {
    const enabledCount = extensions.filter((item) => item.enabled).length;
    const disabledCount = extensions.length - enabledCount;
    return {
      total: extensions.length,
      enabled: enabledCount,
      disabled: disabledCount,
    };
  }, [extensions]);

  const openMarketplaceInstall = (extension: MarketplaceExtensionSummary) => {
    if (!extension.latestVersion) {
      setMarketplaceInstallError(
        `${extension.name} does not expose a latest version in the registry.`,
      );
      return;
    }
    setMarketplaceInstallError(null);
    setMarketplaceAutoEnable(true);
    setInstallCandidate({
      extension,
      version: {
        version: extension.latestVersion.version,
        releaseNotes: extension.latestVersion.releaseNotes,
      },
    });
  };

  const confirmMarketplaceInstall = async () => {
    if (!installCandidate) return;

    setMarketplaceBusyId(installCandidate.extension.id);
    setMarketplaceInstallError(null);
    try {
      const extension = await installExtension({
        source: {
          registryId: installCandidate.extension.registryId,
          extensionId: installCandidate.extension.id,
          version: installCandidate.version.version,
        },
        enabled: marketplaceAutoEnable,
      });
      updateExtensionState(extension);
      setActiveTab("installed");
      void refreshExtensions(true);
      setInstallCandidate(null);
    } catch (err) {
      setMarketplaceInstallError(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setMarketplaceBusyId(null);
    }
  };

  const renderUpdateAlert = (extension: ManagedExtension) => {
    if (!extension.source?.registryId) {
      return (
        <Alert color="gray" title="Updates">
          <Text size="sm">
            Updates are not managed for manually installed extensions.
          </Text>
        </Alert>
      );
    }

    const latest = extension.updateState?.latest;
    if (!latest) return null;

    const isNewer = compareVersions(latest.version, extension.version) > 0;
    const isAcknowledged =
      extension.updateState?.acknowledgedVersion === latest.version;

    if (!isNewer && isAcknowledged) {
      return null;
    }

    const awaitingAction = isNewer && !isAcknowledged;

    return (
      <Alert
        color={awaitingAction ? "violet" : "blue"}
        title={awaitingAction ? "Update available" : "Latest version"}
      >
        <Stack gap={6}>
          <Text size="sm">
            Version <strong>{latest.version}</strong>{" "}
            {awaitingAction ? "is available" : "is currently installed"}.
          </Text>
          {latest.releaseNotes ? (
            <Text
              component="pre"
              className="whitespace-pre-wrap text-xs"
              c="dimmed"
            >
              {latest.releaseNotes}
            </Text>
          ) : null}
          <Group gap="sm">
            {awaitingAction ? (
              <>
                <Button
                  size="xs"
                  color="violet"
                  loading={busyExtensionId === extension.id}
                  onClick={() => void handleApplyUpdate(extension)}
                  leftSection={<ArrowDownToLine size={14} />}
                >
                  Install update
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => void handleAcknowledgeUpdate(extension)}
                  disabled={busyExtensionId === extension.id}
                >
                  Mark as read
                </Button>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                This extension is already on the latest version.
              </Text>
            )}
          </Group>
        </Stack>
      </Alert>
    );
  };

  return (
    <Stack gap="lg">
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as ExtensionTab)}
      >
        <Tabs.List>
          <Tabs.Tab value="installed">Installed</Tabs.Tab>
          <Tabs.Tab value="marketplace">Marketplace</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="installed" pt="md">
          <Stack gap="lg">
            <Card withBorder p="lg">
              <Stack gap="sm">
              <Title order={3}>Install from file</Title>
              <Text size="sm" c="dimmed">
                Provide the absolute path to the compiled extension entry file.
                The API will copy it into the JAMRA data directory.
              </Text>
              <TextInput
                label="Extension entry path"
                placeholder="/path/to/extension/dist/index.js"
                value={installPath}
                onChange={(event) => setInstallPath(event.currentTarget.value)}
              />
              <Group gap="md" align="center">
                <Switch
                  label="Enable immediately after installation"
                  checked={autoEnable}
                  onChange={(event) =>
                    setAutoEnable(event.currentTarget.checked)
                  }
                />
                <Button
                  loading={installing}
                  onClick={() => void handleInstallFromPath()}
                >
                  Install
                </Button>
              </Group>
              {installError ? <Alert color="red">{installError}</Alert> : null}
              </Stack>
            </Card>

            <Card withBorder p="lg">
              <Stack gap="sm">
                <div>
                  <Title order={3}>Installed Extensions</Title>
                  <Text size="sm" c="dimmed">
                    {statusSummary.total === 0
                      ? "No extensions installed yet."
                      : `${statusSummary.enabled} enabled · ${statusSummary.disabled} disabled`}
                  </Text>
                </div>
                <Group gap="md" align="center" wrap="nowrap">
                  <TextInput
                    placeholder="Search by name or author"
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    className="flex-1"
                  />
                  <Group gap="xs" align="center" wrap="nowrap">
                    <SegmentedControl
                      value={statusFilter}
                      onChange={(value) => setStatusFilter(value as StatusFilter)}
                      data={[
                        { label: "All", value: "all" },
                        { label: "Enabled", value: "enabled" },
                        { label: "Disabled", value: "disabled" },
                      ]}
                    />
                    <SegmentedControl
                      value={sort}
                      onChange={(value) => setSort(value as typeof sort)}
                      data={[
                        { label: "Name", value: "name" },
                        { label: "Installed", value: "installedAt" },
                        { label: "Author", value: "author" },
                        { label: "Language", value: "language" },
                      ]}
                    />
                    <Tooltip label={order === "asc" ? "Ascending" : "Descending"}>
                      <ActionIcon
                        variant="light"
                        size="input-sm"
                        onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
                      >
                        {order === "asc" ? (
                          <ArrowUp size={16} />
                        ) : (
                          <ArrowDown size={16} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Refresh">
                      <ActionIcon
                        variant="light"
                        size="input-sm"
                        onClick={() => void refreshExtensions()}
                      >
                        <RefreshCcw size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
                {error ? <Alert color="red">{error}</Alert> : null}
                {loading ? (
                  <Group justify="center" py="xl">
                    <Loader />
                  </Group>
                ) : extensions.length === 0 ? (
                  <Text c="dimmed">No extensions match the current filters.</Text>
                ) : (
                  <Stack gap="sm">
                    {extensions.map((extension) => {
                    const hasErrors = extension.errors.length > 0;
                    const latest = extension.updateState?.latest;
                    const supportsUpdates = Boolean(
                      extension.source?.registryId,
                    );
                    const updateBadge =
                      supportsUpdates &&
                      latest &&
                      compareVersions(latest.version, extension.version) > 0;
                    const sourceLabel =
                      extension.source?.registryId ?? "Manual install";
                    const lastChecked = extension.updateState?.lastCheckedAt
                      ? new Date(
                          extension.updateState.lastCheckedAt,
                        ).toLocaleString()
                      : undefined;
                    const iconSrc = resolveIcon(
                      extension.icon ?? extension.manifest.icon,
                    );

                    return (
                      <Card
                        key={extension.id}
                        withBorder
                        padding="lg"
                        radius="md"
                      >
                        <Stack gap="sm">
                          <Group
                            justify="space-between"
                            align="flex-start"
                            gap="md"
                          >
                            <div className="flex-1">
                              <Group gap="sm" align="flex-start" wrap="nowrap">
                                <Avatar
                                  src={iconSrc}
                                  alt={`${extension.name} icon`}
                                  name={extension.name}
                                  radius="md"
                                  size={56}
                                  color={iconSrc ? undefined : "gray"}
                                  variant={iconSrc ? undefined : "filled"}
                                  className="shrink-0"
                                />
                                <Stack gap={6} className="flex-1">
                                  <Group
                                    gap="sm"
                                    align="center"
                                    wrap="wrap"
                                  >
                                    <Title order={4}>{extension.name}</Title>
                                    <Badge color="gray" variant="light">
                                      v{extension.version}
                                    </Badge>
                                    {extension.enabled ? (
                                      <Badge color="green">Enabled</Badge>
                                    ) : (
                                      <Badge color="yellow">Disabled</Badge>
                                    )}
                                    {extension.loaded ? (
                                      <Badge color="green" variant="light">
                                        Loaded
                                      </Badge>
                                    ) : (
                                      <Badge color="gray" variant="light">
                                        Not loaded
                                      </Badge>
                                    )}
                                    {updateBadge ? (
                                      <Badge color="violet" variant="filled">
                                        Update available
                                      </Badge>
                                    ) : null}
                                  </Group>
                                  <Text size="sm" c="dimmed">
                                    {extension.description ??
                                      "No description provided."}
                                  </Text>
                                  <Text size="sm">
                                    Author:{" "}
                                    <span className="font-medium">
                                      {extension.author.name}
                                    </span>
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    Source: {sourceLabel}
                                    {extension.source?.version
                                      ? ` · v${extension.source.version}`
                                      : ""}
                                  </Text>
                                  {lastChecked ? (
                                    <Text size="xs" c="dimmed">
                                      Updates checked {lastChecked}
                                    </Text>
                                  ) : null}
                                  <Text size="sm" c="dimmed">
                                    Languages:{" "}
                                    {extension.languageCodes.join(", ") || "—"}
                                  </Text>
                                  <Text size="sm" c="dimmed">
                                    Source path: {extension.entryPath ?? "Unknown"}
                                  </Text>
                                </Stack>
                              </Group>
                            </div>
                            <Stack gap="xs" align="flex-end">
                              <Group gap="xs">
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() => openSettingsModal(extension)}
                                >
                                  Settings
                                </Button>
                                {supportsUpdates ? (
                                  <Button
                                    size="xs"
                                    variant="light"
                                    leftSection={<RefreshCcw size={14} />}
                                    loading={busyExtensionId === extension.id}
                                    onClick={() =>
                                      void handleCheckUpdates(extension)
                                    }
                                  >
                                    Check updates
                                  </Button>
                                ) : null}
                                {extension.enabled ? (
                                  <Button
                                    size="xs"
                                    color="yellow"
                                    loading={busyExtensionId === extension.id}
                                    onClick={() =>
                                      void handleDisable(extension)
                                    }
                                  >
                                    Disable
                                  </Button>
                                ) : (
                                  <Button
                                    size="xs"
                                    color="green"
                                    loading={busyExtensionId === extension.id}
                                    onClick={() => void handleEnable(extension)}
                                  >
                                    Enable
                                  </Button>
                                )}
                                <Button
                                  size="xs"
                                  color="red"
                                  variant="outline"
                                  loading={busyExtensionId === extension.id}
                                  onClick={() => requestUninstall(extension)}
                                >
                                  Uninstall
                                </Button>
                              </Group>
                              <Text size="xs" c="dimmed">
                                ID: {extension.id}
                              </Text>
                            </Stack>
                          </Group>

                          {renderUpdateAlert(extension)}

                          {hasErrors ? (
                            <Alert color="red" title="Issues detected">
                              <Stack gap={4}>
                                {extension.errors.map((message) => (
                                  <Text key={message} size="sm">
                                    {message}
                                  </Text>
                                ))}
                              </Stack>
                            </Alert>
                          ) : null}
                          <Divider />
                          <Group gap="xs">
                            <Badge color="blue" variant="light">
                              Installed{" "}
                              {new Date(extension.installedAt).toLocaleString()}
                            </Badge>
                          </Group>
                        </Stack>
                      </Card>
                    );
                    })}
                  </Stack>
                )}
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="marketplace" pt="md">
          <Stack gap="lg">
            <Card withBorder p="lg">
              <Stack gap="sm">
              <Group justify="space-between" align="center">
                <div>
                  <Title order={3}>Marketplace</Title>
                  <Text size="sm" c="dimmed">
                    Browse curated registries and install vetted extension
                    builds.
                  </Text>
                </div>
                <Group gap="xs">
                  <Tooltip label="Refresh">
                    <ActionIcon
                      variant="light"
                      onClick={() => void refreshMarketplace()}
                      loading={marketplaceLoading}
                    >
                      <RefreshCcw size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
              {marketplaceError ? (
                <Alert color="red">{marketplaceError}</Alert>
              ) : null}
              {marketplaceLoading && !marketplace ? (
                <Group justify="center" py="lg">
                  <Loader />
                </Group>
              ) : marketplace && marketplace.extensions.length > 0 ? (
                <Stack gap="md">
                  {marketplace.extensions.map((extension) => {
                    const latest = extension.latestVersion;
                    const iconSrc = resolveIcon(extension.icon);
                    return (
                      <Card
                        key={`${extension.registryId}:${extension.id}`}
                        withBorder
                        padding="lg"
                        radius="md"
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" align="flex-start">
                            <div className="flex-1">
                              <Group gap="sm" align="flex-start" wrap="nowrap">
                                <Avatar
                                  src={iconSrc}
                                  alt={`${extension.name} icon`}
                                  name={extension.name}
                                  radius="md"
                                  size={56}
                                  color={iconSrc ? undefined : "gray"}
                                  variant={iconSrc ? undefined : "filled"}
                                  className="shrink-0"
                                />
                                <Stack gap={6} className="flex-1">
                                  <Group
                                    gap="sm"
                                    align="center"
                                    wrap="wrap"
                                  >
                                    <Title order={4}>{extension.name}</Title>
                                    {latest ? (
                                      <Badge color="gray" variant="light">
                                        v{latest.version}
                                      </Badge>
                                    ) : null}
                                    <Badge color="blue" variant="outline">
                                      {extension.registryLabel}
                                    </Badge>
                                  </Group>
                                  <Text size="sm" c="dimmed">
                                    {extension.summary}
                                  </Text>
                                  <Text size="sm">
                                    Author:{" "}
                                    <span className="font-medium">
                                      {extension.author.name}
                                    </span>
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    Tags:{" "}
                                    {extension.tags.length > 0
                                      ? extension.tags.join(", ")
                                      : "—"}
                                  </Text>
                                  {latest?.releaseNotes ? (
                                    <Text size="xs" c="dimmed">
                                      Latest release notes:{" "}
                                      {latest.releaseNotes.length > 160
                                        ? `${latest.releaseNotes.slice(0, 157)}...`
                                        : latest.releaseNotes}
                                    </Text>
                                  ) : null}
                                </Stack>
                              </Group>
                            </div>
                            <Stack gap="xs" align="flex-end">
                              <Button
                                size="xs"
                                leftSection={<ArrowDownToLine size={14} />}
                                onClick={() =>
                                  openMarketplaceInstall(extension)
                                }
                                loading={marketplaceBusyId === extension.id}
                                disabled={!latest}
                              >
                                Install
                              </Button>
                            </Stack>
                          </Group>
                        </Stack>
                      </Card>
                    );
                  })}
                </Stack>
              ) : (
                <Text c="dimmed">
                  No extensions were published in the configured registries.
                </Text>
              )}
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={settingsModal !== null}
        onClose={closeSettingsModal}
        title={
          settingsModal ? `Settings • ${settingsModal.extension.name}` : ""
        }
        size="lg"
        centered
      >
        {settingsModal ? (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Provide JSON data that will be exposed to the extension via{" "}
              <code>context.settings</code>. Leave empty to reset to defaults.
            </Text>
            <Textarea
              minRows={8}
              value={settingsModal.value}
              onChange={(event) =>
                setSettingsModal((current) =>
                  current
                    ? {
                        ...current,
                        value: event.currentTarget.value,
                        error: null,
                      }
                    : current,
                )
              }
            />
            {settingsModal.error ? (
              <Alert color="red">{settingsModal.error}</Alert>
            ) : null}
            <Group justify="flex-end" gap="sm">
              <Button
                variant="default"
                onClick={closeSettingsModal}
                disabled={settingsModal.saving}
              >
                Cancel
              </Button>
              <Button
                loading={settingsModal.saving}
                onClick={() => void saveSettings()}
              >
                Save
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal
        opened={installCandidate !== null}
        onClose={() => setInstallCandidate(null)}
        title={
          installCandidate
            ? `Install ${installCandidate.extension.name}`
            : "Install extension"
        }
        size="lg"
        centered
      >
        {installCandidate ? (
          <Stack gap="sm">
            <Alert color="yellow" icon={<AlertTriangle size={18} />}>
              {" "}
              {TRUST_WARNING}{" "}
            </Alert>
            <Group gap="sm" align="center">
              <Avatar
                src={installCandidateIcon}
                alt={`${installCandidate.extension.name} icon`}
                name={installCandidate.extension.name}
                radius="md"
                size={56}
                color={installCandidateIcon ? undefined : "gray"}
                variant={installCandidateIcon ? undefined : "filled"}
                className="shrink-0"
              />
              <Stack gap={2} className="flex-1">
                <Title order={4}>{installCandidate.extension.name}</Title>
                <Text size="sm" c="dimmed">
                  {installCandidate.extension.summary}
                </Text>
              </Stack>
            </Group>
            <Text size="sm">
              Registry:{" "}
              <strong>{installCandidate.extension.registryLabel}</strong>
            </Text>
            <Text size="sm">
              Version: <strong>{installCandidate.version.version}</strong>
            </Text>
            <Text size="sm" c="dimmed">
              Release notes
            </Text>
            <Textarea
              readOnly
              minRows={6}
              value={
                installCandidate.version.releaseNotes ||
                "No release notes provided."
              }
            />
            <Switch
              label="Enable immediately after installation"
              checked={marketplaceAutoEnable}
              onChange={(event) =>
                setMarketplaceAutoEnable(event.currentTarget.checked)
              }
            />
            {marketplaceInstallError ? (
              <Alert color="red">{marketplaceInstallError}</Alert>
            ) : null}
            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => setInstallCandidate(null)}
              >
                Cancel
              </Button>
              <Button
                loading={marketplaceBusyId === installCandidate.extension.id}
                onClick={() => void confirmMarketplaceInstall()}
              >
                Install
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal.Root
        opened={uninstallTarget !== null}
        onClose={cancelUninstall}
        centered
        size="md"
      >
        <Modal.Overlay />
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>
              {uninstallTarget
                ? `Remove ${uninstallTarget.name}`
                : "Confirm uninstall"}
            </Modal.Title>
            <Modal.CloseButton />
          </Modal.Header>
          <Modal.Body>
            {uninstallTarget ? (
              <Stack gap="sm">
                <Alert color="red" icon={<AlertTriangle size={18} />}>
                  Removing this extension clears its cached data and settings.
                  This action cannot be undone.
                </Alert>
                <Text size="sm">
                  Are you sure you want to uninstall{" "}
                  <strong>{uninstallTarget.name}</strong>?
                </Text>
                <Group justify="flex-end" gap="sm">
                  <Button
                    variant="default"
                    onClick={cancelUninstall}
                    disabled={busyExtensionId === uninstallTarget.id}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="red"
                    loading={busyExtensionId === uninstallTarget.id}
                    onClick={() => void confirmUninstall()}
                  >
                    Uninstall
                  </Button>
                </Group>
              </Stack>
            ) : null}
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </Stack>
  );
}
