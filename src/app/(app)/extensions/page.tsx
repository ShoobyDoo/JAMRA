import { ExtensionsManager } from "@/components/extensions/extensions-manager";
import { fetchExtensions, type ExtensionListOptions } from "@/lib/api";

type PageSearchParams = Record<string, string | string[] | undefined>;

interface ExtensionsPageProps {
  searchParams: Promise<PageSearchParams>;
}

export const dynamic = "force-dynamic";

export default async function ExtensionsPage({
  searchParams,
}: ExtensionsPageProps) {
  const resolvedParams = await searchParams;
  const initialQuery: ExtensionListOptions = {};

  const readParam = (key: string) => {
    const value = resolvedParams[key];
    if (Array.isArray(value)) return value[0];
    return typeof value === "string" ? value : undefined;
  };

  const search = readParam("search");
  const status = readParam("status");
  const sort = readParam("sort");
  const order = readParam("order");

  if (search) initialQuery.search = search;
  if (status === "enabled" || status === "disabled") {
    initialQuery.status = status;
  }
  if (
    sort === "name" ||
    sort === "installedAt" ||
    sort === "author" ||
    sort === "language"
  ) {
    initialQuery.sort = sort;
  }
  if (order === "asc" || order === "desc") {
    initialQuery.order = order;
  }

  let extensions: Awaited<ReturnType<typeof fetchExtensions>> = [];
  let initialError: string | null = null;
  try {
    extensions = await fetchExtensions(initialQuery);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    initialError = message.includes("/api/extensions")
      ? "Extensions API is unavailable. Restart the catalog server or update it to a version that exposes /api/extensions."
      : message;
    extensions = [];
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Extensions</h1>
        <p className="text-muted-foreground">
          Install, enable, disable, and configure catalogue extensions.
        </p>
      </div>
      <ExtensionsManager
        initialExtensions={extensions}
        initialQuery={initialQuery}
        initialError={initialError}
      />
    </div>
  );
}
