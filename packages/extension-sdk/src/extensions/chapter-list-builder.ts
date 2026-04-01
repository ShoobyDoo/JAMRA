import type { Chapter, LocaleCode } from "../index.js";

const DEFAULT_LANGUAGE: LocaleCode = "en";

export interface ChapterSource {
  remoteId: string;
  title?: string;
  chapterNumber?: number;
  publishedAt?: Chapter["publishedAt"];
  language?: LocaleCode;
  volume?: number;
  scanlator?: string;
  pages?: number;
}

export interface ChapterListBuilderOptions {
  normalizeSlug?: (value: string) => string;
  defaultLanguage?: LocaleCode;
  slugStrategy?: {
    derive?: (input: {
      seriesSlug: string;
      title?: string;
      chapterNumber?: number;
      remoteId: string;
    }) => string;
    formatNumber?: (value: number) => string;
  };
  decorate?: (chapter: Chapter, source: ChapterSource) => Chapter;
}

const normalize = (value: string): string => {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "chapter";
};

const formatNumber = (value: number): string => {
  if (Number.isInteger(value)) {
    return `${value}`;
  }
  return value.toString().replace(/\.0+$/, "");
};

export class ChapterListBuilder {
  private readonly normalizeSlug: (value: string) => string;
  private readonly formatChapterNumber: (value: number) => string;
  private readonly chapterRemoteIds = new Map<string, string>();

  constructor(private readonly options: ChapterListBuilderOptions = {}) {
    this.normalizeSlug = options.normalizeSlug ?? normalize;
    this.formatChapterNumber =
      options.slugStrategy?.formatNumber ?? formatNumber;
  }

  build(seriesSlug: string, sources: ChapterSource[]): Chapter[] {
    const normalizedSeries = this.normalizeSlug(seriesSlug);
    this.clearSeries(normalizedSeries);
    const usedSlugs = new Set<string>();
    const chapters: Chapter[] = [];

    for (const source of sources) {
      const slug = this.buildSlug(normalizedSeries, source, usedSlugs);
      const chapter: Chapter = {
        id: slug,
        title: source.title ?? slug,
        chapterNumber: source.chapterNumber,
        language: source.language ?? this.options.defaultLanguage ?? DEFAULT_LANGUAGE,
        publishedAt: source.publishedAt,
        volume: source.volume,
        scanlator: source.scanlator,
        pages: source.pages,
      };
      const finalChapter = this.options.decorate
        ? this.options.decorate(chapter, source)
        : chapter;
      chapters.push(finalChapter);
      this.register(normalizedSeries, slug, source.remoteId);
    }

    return chapters;
  }

  getRemoteChapterId(
    seriesSlug: string,
    chapterSlug: string,
  ): string | undefined {
    return this.chapterRemoteIds.get(
      this.buildKey(seriesSlug, chapterSlug),
    );
  }

  register(seriesSlug: string, chapterSlug: string, remoteId: string): void {
    this.chapterRemoteIds.set(
      this.buildKey(seriesSlug, chapterSlug),
      remoteId,
    );
  }

  clearSeries(seriesSlug: string): void {
    const normalized = this.normalizeSlug(seriesSlug);
    const prefix = `${normalized}::`;
    for (const key of Array.from(this.chapterRemoteIds.keys())) {
      if (key.startsWith(prefix)) {
        this.chapterRemoteIds.delete(key);
      }
    }
  }

  private buildSlug(
    seriesSlug: string,
    source: ChapterSource,
    usedSlugs: Set<string>,
  ): string {
    const baseValue = this.options.slugStrategy?.derive
      ? this.options.slugStrategy.derive({
          seriesSlug,
          title: source.title,
          chapterNumber: source.chapterNumber,
          remoteId: source.remoteId,
        })
      : this.deriveDefaultSlug(source);

    let slug = this.normalizeSlug(baseValue);
    if (!slug) {
      slug = this.normalizeSlug(source.remoteId);
    }
    const baseSlug = slug;

    let counter = 2;
    while (
      usedSlugs.has(slug) ||
      this.chapterRemoteIds.has(this.buildKey(seriesSlug, slug))
    ) {
      slug = `${baseSlug}-${counter++}`;
    }
    usedSlugs.add(slug);
    return slug;
  }

  private deriveDefaultSlug(source: ChapterSource): string {
    if (source.chapterNumber !== undefined) {
      return this.formatChapterNumber(source.chapterNumber);
    }
    if (source.title) {
      const normalized = source.title.replace(/chapter/i, "").trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
    return source.remoteId;
  }

  private buildKey(seriesSlug: string, chapterSlug: string): string {
    return `${this.normalizeSlug(seriesSlug)}::${this.normalizeSlug(chapterSlug)}`;
  }
}
