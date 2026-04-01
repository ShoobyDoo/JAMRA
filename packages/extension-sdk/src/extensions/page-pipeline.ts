import type { Page } from "../index.js";
import { HtmlScraperClient } from "./html-scraper-client.js";

export type PageTransformer = (pages: Page[]) => Page[];

export interface PagePipelineOptions {
  scraper: HtmlScraperClient;
  buildRequest: (
    remoteChapterId: string,
  ) => {
    path: string;
    params?: Record<string, string | undefined>;
    headers?: Record<string, string | undefined>;
  };
  parser: (html: string, context: { remoteChapterId: string }) => Page[];
}

export interface PagePipelineFetchOptions {
  transformers?: PageTransformer[];
}

export class PagePipeline {
  constructor(private readonly options: PagePipelineOptions) {}

  async fetch(
    remoteChapterId: string,
    options?: PagePipelineFetchOptions,
  ): Promise<Page[]> {
    const request = this.options.buildRequest(remoteChapterId);
    const html = await this.options.scraper.get(request.path, {
      params: request.params,
      headers: request.headers,
    });

    let pages = this.options.parser(html, { remoteChapterId });
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error("No pages were returned for the requested chapter");
    }

    if (options?.transformers) {
      for (const transformer of options.transformers) {
        pages = transformer(pages);
      }
    }

    return pages;
  }

  static rewriteHosts(host?: string): PageTransformer {
    if (!host) {
      return (pages) => pages;
    }
    const trimmed = host.trim();
    if (!trimmed) {
      return (pages) => pages;
    }
    return (pages) =>
      pages.map((page) => {
        try {
          const url = new URL(page.imageUrl);
          url.hostname = trimmed;
          return { ...page, imageUrl: url.toString() };
        } catch {
          return page;
        }
      });
  }
}
