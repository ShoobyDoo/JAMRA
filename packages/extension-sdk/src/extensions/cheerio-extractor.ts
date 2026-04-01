import type { CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";

export interface BaseFieldOptions {
  into: string;
  allowEmpty?: boolean;
}

export interface TextFieldOptions extends BaseFieldOptions {
  selector?: string;
  attribute?: string;
  label?: string;
  fallback?: string | (() => string | undefined);
  transform?: (value: string) => string;
}

export interface ListFieldOptions extends BaseFieldOptions {
  selector?: string;
  label?: string;
  unique?: boolean;
  delimiter?: string | RegExp;
  transform?: (value: string) => string | undefined;
}

export interface CanonicalFieldOptions extends BaseFieldOptions {
  selector?: string;
  fallback?: string | (() => string | undefined);
}

export class CheerioExtractor<TState extends Record<string, unknown>> {
  private constructor(
    private readonly $: CheerioAPI,
    private readonly state: TState,
  ) {}

  static for<TState extends Record<string, unknown>>(
    $: CheerioAPI,
    initialState: TState,
  ): CheerioExtractor<TState> {
    return new CheerioExtractor($, initialState);
  }

  text(options: TextFieldOptions): this {
    let value: string | undefined;
    if (options.selector) {
      const node = this.$(options.selector).first();
      if (node.length) {
        value = options.attribute
          ? node.attr(options.attribute) ?? undefined
          : node.text();
      }
    }

    if (!value && options.label) {
      value = extractLabelText(this.$, options.label);
    }

    if (!value && options.fallback) {
      value =
        typeof options.fallback === "function"
          ? options.fallback()
          : options.fallback;
    }

    value = typeof value === "string" ? value.trim() : undefined;
    if (!value && !options.allowEmpty) {
      return this;
    }

    const finalValue =
      value && options.transform ? options.transform(value) : value;
    if (finalValue !== undefined) {
      assignPath(this.state, options.into, finalValue);
    }
    return this;
  }

  list(options: ListFieldOptions): this {
    const unique = options.unique ?? true;
    const seen = new Set<string>();
    const values: string[] = [];

    const pushValue = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }
      const transformed = options.transform
        ? options.transform(trimmed)
        : trimmed;
      if (!transformed) {
        return;
      }
      if (unique && seen.has(transformed)) {
        return;
      }
      seen.add(transformed);
      values.push(transformed);
    };

    if (options.selector) {
      this.$(options.selector).each((_, element: AnyNode) => {
        pushValue(this.$(element as Element).text());
      });
    } else if (options.label) {
      for (const value of extractLabelList(this.$, options.label)) {
        pushValue(value);
      }
    }

    if (values.length === 0 && options.delimiter && options.selector) {
      const text = this.$(options.selector).text();
      if (text) {
        for (const part of text.split(options.delimiter)) {
          pushValue(part);
        }
      }
    }

    if (values.length > 0 || options.allowEmpty) {
      assignPath(this.state, options.into, values);
    }
    return this;
  }

  canonical(options: CanonicalFieldOptions): this {
    let value: string | undefined;
    if (options.selector) {
      value = this.$(options.selector).attr("href") ?? undefined;
    }
    if (!value && options.fallback) {
      value =
        typeof options.fallback === "function"
          ? options.fallback()
          : options.fallback;
    }
    if (value || options.allowEmpty) {
      assignPath(this.state, options.into, value);
    }
    return this;
  }

  set(path: string, value: unknown): this {
    assignPath(this.state, path, value);
    return this;
  }

  result(): TState {
    return this.state;
  }
}

const assignPath = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void => {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) {
    return;
  }
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    if (
      typeof cursor[segment] !== "object" ||
      cursor[segment] === null ||
      Array.isArray(cursor[segment])
    ) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
};

const extractLabelText = (
  $root: CheerioAPI,
  label: string,
): string | undefined => {
  const strong = $root("li > strong").filter((_, element) =>
    $root(element).text().trim().toLowerCase().startsWith(label.toLowerCase()),
  );
  if (!strong.length) {
    return undefined;
  }
  const parent = strong.parent();
  const cloned = parent.clone();
  cloned.children("strong").remove();
  const text = cloned.text().replace(/\s+/g, " ").trim();
  return text || undefined;
};

const extractLabelList = (
  $root: CheerioAPI,
  label: string,
): string[] => {
  const strong = $root("li > strong").filter((_, element) =>
    $root(element).text().trim().toLowerCase().startsWith(label.toLowerCase()),
  );
  if (!strong.length) {
    return [];
  }
  const parent = strong.parent();
  return parent
    .find("a, span")
    .not("strong")
    .map((_, element) => $root(element).text().replace(/,/g, "").trim())
    .get()
    .filter(Boolean);
};
