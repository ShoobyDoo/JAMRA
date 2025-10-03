function buildUrl(input, query) {
    if (!query)
        return input;
    const url = new URL(input, input.startsWith("http") ? undefined : "http://localhost");
    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined)
            return;
        url.searchParams.set(key, String(value));
    });
    return url.toString();
}
function normalizeHeaders(headers) {
    const result = {};
    headers.forEach((value, key) => {
        result[key] = value;
    });
    return result;
}
async function parseBody(response) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        return response.json();
    }
    if (contentType.includes("text/")) {
        return response.text();
    }
    return response.arrayBuffer();
}
export class FetchExtensionHttpClient {
    constructor(options = {}) {
        this.options = options;
    }
    async request(url, options = {}) {
        const finalUrl = buildUrl(url, options.query);
        const headers = new Headers({
            ...this.options.defaultHeaders,
            ...options.headers,
        });
        let body;
        if (options.body !== undefined) {
            if (options.body instanceof ArrayBuffer ||
                ArrayBuffer.isView(options.body)) {
                body = options.body;
            }
            else if (typeof options.body === "string") {
                body = options.body;
            }
            else {
                body = JSON.stringify(options.body);
                if (!headers.has("content-type")) {
                    headers.set("content-type", "application/json");
                }
            }
        }
        const controller = options.signal ? undefined : new AbortController();
        const timeout = options.timeoutMs;
        const abortSignal = options.signal ?? controller?.signal;
        let timeoutHandle;
        if (controller && timeout) {
            timeoutHandle = setTimeout(() => controller.abort(), timeout);
        }
        try {
            const response = await fetch(finalUrl, {
                method: options.method ?? (body ? "POST" : "GET"),
                headers,
                body,
                signal: abortSignal,
            });
            const data = (await parseBody(response));
            return {
                status: response.status,
                statusText: response.statusText,
                headers: normalizeHeaders(response.headers),
                data,
            };
        }
        finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }
}
