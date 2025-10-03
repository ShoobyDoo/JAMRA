import type { ExtensionHttpClient, HttpRequestOptions, HttpResponse } from "@jamra/extension-sdk";
export interface FetchHttpClientOptions {
    defaultHeaders?: Record<string, string>;
}
export declare class FetchExtensionHttpClient implements ExtensionHttpClient {
    private readonly options;
    constructor(options?: FetchHttpClientOptions);
    request<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
}
//# sourceMappingURL=httpClient.d.ts.map