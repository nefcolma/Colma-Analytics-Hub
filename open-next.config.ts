// OpenNext configuration for deploying Next.js to Cloudflare Workers.
// Docs: https://opennext.js.org/cloudflare
//
// `defineCloudflareConfig` is provided by @opennextjs/cloudflare (a
// production-only dependency). The import is intentionally not resolved during
// unit tests / `next dev`; this file is only consumed by the OpenNext build.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Report caching is handled explicitly via the REPORT_CACHE_KV binding in
  // src/lib/cache.ts, so no incremental cache adapter is configured here.
});
