export interface FilterNormalizationContext<Mode extends string = string> {
  key: string;
  mode: Mode;
  query: string;
  rawFilters?: Record<string, unknown>;
}

export interface FilterDescriptor<
  FilterState extends Record<string, unknown>,
  TValue = unknown,
> {
  key: string;
  kind: "string" | "enum" | "string[]";
  aliases?: string[];
  values?: readonly string[];
  default?: TValue | ((ctx: FilterNormalizationContext) => TValue);
  delimiter?: string | RegExp;
  dedupe?: boolean;
  allowEmpty?: boolean;
  caseInsensitive?: boolean;
  transform?: (value: TValue, ctx: FilterNormalizationContext) => TValue;
  apply?: (
    state: FilterState,
    value: TValue,
    ctx: FilterNormalizationContext,
  ) => void;
}

export interface SearchControllerOptions<
  Mode extends string,
  FilterState extends Record<string, unknown>,
> {
  modes: readonly Mode[];
  defaultMode: Mode;
  hotMode?: Mode;
  searchMode?: Mode;
  deriveMode?: (input: { query: string; rawMode?: string }) => Mode;
  initialState: () => FilterState;
  filters: Array<FilterDescriptor<FilterState>>;
  finalize?: (
    state: FilterState,
    ctx: { mode: Mode; query: string; rawFilters?: Record<string, unknown> },
  ) => FilterState;
}

export interface SearchControllerResult<
  Mode extends string,
  FilterState extends Record<string, unknown>,
> {
  mode: Mode;
  query: string;
  filters: FilterState;
}

export interface SearchController<
  Mode extends string,
  FilterState extends Record<string, unknown>,
> {
  normalize(
    raw: Record<string, unknown> | undefined,
    query: string | undefined,
  ): SearchControllerResult<Mode, FilterState>;
  shouldHydrateHot(
    result: SearchControllerResult<Mode, FilterState>,
  ): boolean;
}

export const createSearchController = <
  Mode extends string,
  FilterState extends Record<string, unknown>,
>(
  options: SearchControllerOptions<Mode, FilterState>,
): SearchController<Mode, FilterState> => {
  const modeSet = new Set(options.modes);

  const normalize = (
    rawFilters: Record<string, unknown> | undefined,
    query: string | undefined,
  ): SearchControllerResult<Mode, FilterState> => {
    const trimmedQuery = query?.trim() ?? "";
    const rawMode =
      typeof rawFilters?.mode === "string" ? rawFilters.mode : undefined;
    const mode = deriveMode(
      options,
      { query: trimmedQuery, rawMode },
      modeSet,
    );

    const state = options.initialState();
    const baseCtx: FilterNormalizationContext<Mode> = {
      key: "",
      mode,
      query: trimmedQuery,
      rawFilters,
    };

    for (const descriptor of options.filters) {
      const ctx = { ...baseCtx, key: descriptor.key };
      const resolved = resolveFilterValue(descriptor, rawFilters, ctx);
      if (resolved === undefined) {
        continue;
      }
      if (descriptor.apply) {
        descriptor.apply(state, resolved, ctx);
      } else {
        assignPathValue(state, descriptor.key, resolved);
      }
    }

    const finalized = options.finalize
      ? options.finalize(state, { mode, query: trimmedQuery, rawFilters })
      : state;

    return { mode, query: trimmedQuery, filters: finalized };
  };

  const shouldHydrateHot = (
    result: SearchControllerResult<Mode, FilterState>,
  ): boolean => {
    if (!options.hotMode) {
      return false;
    }
    return result.mode === options.hotMode && result.query.length === 0;
  };

  return { normalize, shouldHydrateHot };
};

const deriveMode = <
  Mode extends string,
  FilterState extends Record<string, unknown>,
>(
  options: SearchControllerOptions<Mode, FilterState>,
  input: { query: string; rawMode?: string },
  modeSet: Set<Mode>,
): Mode => {
  if (options.deriveMode) {
    return sanitizeMode(options.deriveMode(input), options.defaultMode, modeSet);
  }

  if (input.query.length > 0 && options.searchMode) {
    return sanitizeMode(options.searchMode, options.defaultMode, modeSet);
  }

  if (input.rawMode && modeSet.has(input.rawMode as Mode)) {
    return input.rawMode as Mode;
  }

  if (options.hotMode && input.query.length === 0) {
    return sanitizeMode(options.hotMode, options.defaultMode, modeSet);
  }

  return options.defaultMode;
};

const sanitizeMode = <Mode extends string>(
  value: Mode,
  fallback: Mode,
  modes: Set<Mode>,
): Mode => {
  return modes.has(value) ? value : fallback;
};

const resolveFilterValue = <
  Mode extends string,
  FilterState extends Record<string, unknown>,
  TValue,
>(
  descriptor: FilterDescriptor<FilterState, TValue>,
  rawFilters: Record<string, unknown> | undefined,
  ctx: FilterNormalizationContext<Mode>,
): TValue | undefined => {
  const rawValue = readRawValue(descriptor, rawFilters);
  let resolved: TValue | undefined;

  switch (descriptor.kind) {
    case "string":
      resolved = normalizeStringFilter(rawValue, descriptor) as TValue;
      break;
    case "enum":
      resolved = normalizeEnumFilter(rawValue, descriptor) as TValue;
      break;
    case "string[]":
      resolved = normalizeStringArrayFilter(rawValue, descriptor) as TValue;
      break;
    default:
      resolved = undefined;
  }

  if (resolved === undefined && descriptor.default !== undefined) {
    resolved =
      typeof descriptor.default === "function"
        ? (descriptor.default as (
            normalizeCtx: FilterNormalizationContext,
          ) => TValue)(ctx)
        : descriptor.default;
  }

  if (resolved === undefined) {
    return undefined;
  }

  return descriptor.transform ? descriptor.transform(resolved, ctx) : resolved;
};

const readRawValue = <
  FilterState extends Record<string, unknown>,
  TValue,
>(
  descriptor: FilterDescriptor<FilterState, TValue>,
  rawFilters: Record<string, unknown> | undefined,
): unknown => {
  if (!rawFilters) {
    return undefined;
  }

  const lookupKeys =
    descriptor.aliases && descriptor.aliases.length > 0
      ? descriptor.aliases
      : [descriptor.key];

  for (const key of lookupKeys) {
    if (key in rawFilters) {
      return rawFilters[key];
    }
  }
  return undefined;
};

const normalizeStringFilter = <
  FilterState extends Record<string, unknown>,
  TValue,
>(
  raw: unknown,
  descriptor: FilterDescriptor<FilterState, TValue>,
): string | undefined => {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length === 0 && !descriptor.allowEmpty) {
      return undefined;
    }
    return trimmed;
  }
  return undefined;
};

const normalizeEnumFilter = <
  FilterState extends Record<string, unknown>,
  TValue,
>(
  raw: unknown,
  descriptor: FilterDescriptor<FilterState, TValue>,
): string | undefined => {
  if (typeof raw !== "string" || !descriptor.values) {
    return undefined;
  }
  const candidate = descriptor.caseInsensitive
    ? raw.trim().toLowerCase()
    : raw.trim();
  for (const value of descriptor.values) {
    if (
      (descriptor.caseInsensitive ? value.toLowerCase() : value) === candidate
    ) {
      return value;
    }
  }
  return undefined;
};

const normalizeStringArrayFilter = <
  FilterState extends Record<string, unknown>,
  TValue,
>(
  raw: unknown,
  descriptor: FilterDescriptor<FilterState, TValue>,
): string[] | undefined => {
  const dedupe = descriptor.dedupe ?? true;
  const seen = new Set<string>();
  const results: string[] = [];

  const pushValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    if (dedupe) {
      if (seen.has(trimmed)) {
        return;
      }
      seen.add(trimmed);
    }
    results.push(trimmed);
  };

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string") {
        pushValue(entry);
      }
    }
  } else if (typeof raw === "string") {
    const delimiter = descriptor.delimiter ?? ",";
    for (const part of raw.split(delimiter)) {
      pushValue(part);
    }
  }

  if (results.length === 0) {
    return undefined;
  }
  return results;
};

const assignPathValue = (
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
