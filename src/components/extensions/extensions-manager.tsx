"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
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
import { logger } from "@/lib/logger";
import { AlertTriangle } from "lucide-react";
import { InstallFromFileCard } from "./install-from-file-card";
import {
  ExtensionsToolbar,
  StatusFilter,
} from "./extensions-toolbar";
import { ExtensionCard } from "./extension-card";
import { ExtensionsMarketplace } from "./extensions-marketplace";
import { resolveIcon } from "./utils";
import { TRUST_WARNING } from "./constants";
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
  const [expandedExtensionIds, setExpandedExtensionIds] = useState<Set<string>>(
    new Set(),
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const installCandidateIcon = installCandidate
    ? resolveIcon(installCandidate.extension.icon)
    : undefined;

  const [debouncedSearch] = useDebouncedValue(search, 300);
  const isFirstRender = useRef(true);

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
      notifications.show({
        message: "Copied to clipboard",
        color: "green",
        autoClose: 2000,
      });
    } catch (err) {
      logger.error("Failed to copy value to clipboard", {
        component: "ExtensionsManager",
        action: "copy-to-clipboard",
        fieldId,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      notifications.show({
        title: "Failed to copy",
        message: err instanceof Error ? err.message : "Unknown error",
        color: "red",
        autoClose: 4000,
      });
    }
  };

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
      });
      if (autoEnable && extension.id) {
        await enableExtension(extension.id);
      }
      updateExtensionState(extension);
      setInstallPath("");
      setAutoEnable(true);
      void refreshExtensions(true);
      notifications.show({
        title: "Extension installed",
        message: `${extension.name} has been installed successfully`,
        color: "green",
        autoClose: 3000,
      });
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
      notifications.show({
        message: `${extension.name} enabled successfully`,
        color: "green",
        autoClose: 3000,
      });
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
      notifications.show({
        message: `${extension.name} disabled successfully`,
        color: "yellow",
        autoClose: 3000,
      });
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
      notifications.show({
        title: "Extension uninstalled",
        message: `${uninstallTarget.name} has been removed`,
        color: "blue",
        autoClose: 3000,
      });
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

      // Notify if update is available
      const latest = updated.updateState?.latest;
      if (latest && compareVersions(latest.version, updated.version) > 0) {
        notifications.show({
          title: "Update available",
          message: `${extension.name} v${latest.version} is available`,
          color: "violet",
          autoClose: 4000,
        });
      } else {
        notifications.show({
          message: `${extension.name} is up to date`,
          color: "green",
          autoClose: 3000,
        });
      }
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
      notifications.show({
        message: "Update marked as read",
        color: "blue",
        autoClose: 3000,
      });
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
      });
      // Maintain the enabled state
      if (extension.enabled && !updated.enabled) {
        await enableExtension(updated.id);
      } else if (!extension.enabled && updated.enabled) {
        await disableExtension(updated.id);
      }
      updateExtensionState(updated);
      void refreshExtensions(true);
      notifications.show({
        title: "Extension updated",
        message: `${extension.name} updated to v${latest.version}`,
        color: "green",
        autoClose: 3000,
      });
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
      notifications.show({
        message: "Settings saved successfully",
        color: "green",
        autoClose: 3000,
      });
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

  const handleToggleExtension = useCallback(
    (extensionId: string, event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("a") ||
        target.closest('[role="button"]')
      ) {
        return;
      }

      setExpandedExtensionIds((prev) => {
        const next = new Set(prev);
        if (next.has(extensionId)) {
          next.delete(extensionId);
        } else {
          next.add(extensionId);
        }
        return next;
      });
    },
    [],
  );

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
      });
      if (marketplaceAutoEnable && extension.id) {
        await enableExtension(extension.id);
      }
      updateExtensionState(extension);
      setActiveTab("installed");
      void refreshExtensions(true);
      setInstallCandidate(null);
      notifications.show({
        title: "Extension installed",
        message: `${installCandidate.extension.name} has been installed successfully`,
        color: "green",
        autoClose: 3000,
      });
    } catch (err) {
      setMarketplaceInstallError(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setMarketplaceBusyId(null);
    }
  };

  return (
    <Stack gap="lg">
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as ExtensionTab)}
      >
        <Tabs.List className="[&_button:hover:not([data-active])]:bg-gray-100 dark:[&_button:hover:not([data-active])]:bg-gray-800">
          <Tabs.Tab value="installed">Installed</Tabs.Tab>
          <Tabs.Tab value="marketplace">Marketplace</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="installed" pt="md">
          <Stack gap="lg">
            <InstallFromFileCard
              installPath={installPath}
              autoEnable={autoEnable}
              isInstalling={installing}
              error={installError}
              onPathChange={(value) => setInstallPath(value)}
              onToggleAutoEnable={(value) => setAutoEnable(value)}
              onInstall={() => void handleInstallFromPath()}
            />

            <Card withBorder p="lg">
              <Stack gap="sm">
                <div>
                  <Title order={3}>Installed Extensions</Title>
                  <Text size="sm" c="dimmed">
                    Manage extensions installed from files or the marketplace.
                  </Text>
                </div>

                <ExtensionsToolbar
                  search={search}
                  statusFilter={statusFilter}
                  sort={sort}
                  order={order}
                  statusSummary={statusSummary}
                  onSearchChange={(value) => setSearch(value)}
                  onStatusFilterChange={(value) => setStatusFilter(value)}
                  onSortChange={(value) => setSort(value)}
                  onToggleOrder={() =>
                    setOrder(order === "asc" ? "desc" : "asc")
                  }
                  onRefresh={() => void refreshExtensions()}
                />

                {error ? <Alert color="red">{error}</Alert> : null}

                {loading ? (
                  <Group justify="center" py="xl">
                    <Loader />
                  </Group>
                ) : extensions.length === 0 ? (
                  <Text c="dimmed">No extensions match the current filters.</Text>
                ) : (
                  <Stack gap="sm">
                    {extensions.map((extension) => (
                      <ExtensionCard
                        key={extension.id}
                        extension={extension}
                        isExpanded={expandedExtensionIds.has(extension.id)}
                        busyExtensionId={busyExtensionId}
                        copiedField={copiedField}
                        onToggle={(event) =>
                          handleToggleExtension(extension.id, event as MouseEvent<HTMLDivElement>)
                        }
                        onEnable={handleEnable}
                        onDisable={handleDisable}
                        onCheckUpdates={handleCheckUpdates}
                        onApplyUpdate={handleApplyUpdate}
                        onAcknowledgeUpdate={handleAcknowledgeUpdate}
                        onOpenSettings={openSettingsModal}
                        onRequestUninstall={requestUninstall}
                        onCopy={copyToClipboard}
                      />
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="marketplace" pt="md">
          <ExtensionsMarketplace
            marketplace={marketplace}
            loading={marketplaceLoading}
            error={marketplaceError}
            onRefresh={() => void refreshMarketplace()}
            onInstall={openMarketplaceInstall}
          />
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={settingsModal !== null}
        onClose={closeSettingsModal}
        title={
          settingsModal
            ? `Configure ${settingsModal.extension.name}`
            : "Extension settings"
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
