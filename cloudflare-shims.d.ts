// Minimal Cloudflare Workers type shims.
//
// `npm run cf-typegen` generates cloudflare-env.d.ts referencing `KVNamespace`
// and `Fetcher`. We deliberately generate that file with `--include-runtime
// false`: the full workerd runtime types override DOM globals (e.g. they make
// `Response.json()` return `unknown`), which breaks the app's browser/client
// code that assumes the DOM lib. These lightweight, DOM-compatible declarations
// provide just the two binding types the env interface needs.
//
// If you later add `@cloudflare/workers-types`, delete this file to avoid
// duplicate declarations.

/** Subset of the Workers KV API used by src/lib/cache.ts. */
interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number; expiration?: number; metadata?: unknown }
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Service/asset binding — only the standard fetch entrypoint is needed here. */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
