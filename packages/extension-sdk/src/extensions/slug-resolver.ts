export type SlugHydrator = (slug: string) => Promise<string>;

export interface SlugResolverOptions {
  normalize?: (value: string) => string;
  hydrate?: SlugHydrator;
  isRemoteId?: (value: string) => boolean;
}

const defaultNormalizeSlug = (value: string): string => {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "series";
};

export class SlugResolver {
  private readonly normalize: (value: string) => string;
  private readonly slugToRemoteId = new Map<string, string>();
  private readonly remoteIdToSlug = new Map<string, string>();
  private readonly inFlight = new Map<string, Promise<string>>();

  constructor(private readonly options: SlugResolverOptions) {
    this.normalize = options.normalize ?? defaultNormalizeSlug;
  }

  register(slug: string, remoteId: string): void {
    const normalized = this.normalize(slug);
    this.slugToRemoteId.set(normalized, remoteId);
    this.remoteIdToSlug.set(remoteId, normalized);
  }

  getRemoteId(slug: string): string | undefined {
    return this.slugToRemoteId.get(this.normalize(slug));
  }

  getSlug(remoteId: string): string | undefined {
    return this.remoteIdToSlug.get(remoteId);
  }

  clear(): void {
    this.slugToRemoteId.clear();
    this.remoteIdToSlug.clear();
    this.inFlight.clear();
  }

  isRemoteId(value: string): boolean {
    if (this.options.isRemoteId) {
      return this.options.isRemoteId(value);
    }
    return /^[A-Za-z0-9_-]+$/.test(value);
  }

  async ensureRemoteId(
    slugOrRemoteId: string,
    hydrator?: SlugHydrator,
  ): Promise<string> {
    if (this.isRemoteId(slugOrRemoteId)) {
      const slug =
        this.remoteIdToSlug.get(slugOrRemoteId) ??
        this.normalize(slugOrRemoteId);
      this.register(slug, slugOrRemoteId);
      return slugOrRemoteId;
    }

    const normalized = this.normalize(slugOrRemoteId);
    const cached = this.slugToRemoteId.get(normalized);
    if (cached) {
      return cached;
    }

    let promise = this.inFlight.get(normalized);
    if (!promise) {
      const hydrateFn = hydrator ?? this.options.hydrate;
      if (!hydrateFn) {
        throw new Error("SlugResolver requires a hydrate function");
      }
      promise = hydrateFn(normalized)
        .then((remoteId) => {
          this.register(normalized, remoteId);
          return remoteId;
        })
        .finally(() => {
          this.inFlight.delete(normalized);
        });
      this.inFlight.set(normalized, promise);
    }

    return promise;
  }
}

export const normalizeSlug = (value: string): string => {
  return defaultNormalizeSlug(value);
};
