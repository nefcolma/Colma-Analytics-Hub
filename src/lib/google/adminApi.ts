import { globalCache } from "../cache";
import { mapWithLimit } from "../concurrency";
import { fetchWithRetry } from "../retry";
import type { PropertiesResponse, PropertySummary } from "../types";
import { errorFromStatus, GoogleApiError } from "./errors";

const ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";

type AccountSummary = {
  account?: string; // "accounts/123"
  displayName?: string;
  propertySummaries?: { property?: string; displayName?: string }[];
};

type PropertyDetail = { timeZone?: string; currencyCode?: string };

const summariesCache = globalCache<PropertiesResponse>("accountSummaries", 5 * 60 * 1000);
const detailCache = globalCache<PropertyDetail>("propertyDetail", 30 * 60 * 1000);

function idFromResource(resource: string | undefined): string {
  return resource?.split("/").pop() ?? "";
}

async function adminGet(path: string, accessToken: string, context: string): Promise<unknown> {
  const res = await fetchWithRetry(`${ADMIN_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new GoogleApiError(errorFromStatus(res.status, context));
  return res.json();
}

/** Lists every account + property the user can access, following pagination. */
export async function listAccountSummaries(
  accessToken: string,
  cacheKey: string,
  opts: { enrichDetails?: boolean } = {}
): Promise<PropertiesResponse> {
  const enrich = opts.enrichDetails ?? true;
  // A fully-enriched result is a superset, so names-only callers can reuse it.
  const enriched = summariesCache.get(cacheKey);
  if (enriched) return enriched;
  // Names-only results are cached separately so they never overwrite the
  // enriched entry the Sites page relies on for time zone / currency.
  const storeKey = enrich ? cacheKey : `${cacheKey}|names`;
  if (!enrich) {
    const namesOnly = summariesCache.get(storeKey);
    if (namesOnly) return namesOnly;
  }

  const accounts = new Map<
    string,
    { accountId: string; accountName: string; properties: PropertySummary[] }
  >();
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: "200" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = (await adminGet(
      `/accountSummaries?${params}`,
      accessToken,
      "listing Analytics accounts"
    )) as { accountSummaries?: AccountSummary[]; nextPageToken?: string };

    for (const acc of data.accountSummaries ?? []) {
      const accountId = idFromResource(acc.account);
      const accountName = acc.displayName ?? `Account ${accountId}`;
      const entry = accounts.get(accountId) ?? { accountId, accountName, properties: [] };
      for (const p of acc.propertySummaries ?? []) {
        const propertyId = idFromResource(p.property);
        if (!propertyId) continue;
        entry.properties.push({
          propertyId,
          propertyName: p.displayName ?? `Property ${propertyId}`,
          accountId,
          accountName,
        });
      }
      accounts.set(accountId, entry);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  // Enrich with time zone and currency (Admin API properties.get), limited
  // concurrency. Skipped for report generation (enrichDetails: false), which
  // reads time zone / currency from the GA report metadata instead — this keeps
  // each report request well under Cloudflare Workers' per-request subrequest
  // limit even when many sites are selected.
  if (enrich) {
    const all = [...accounts.values()].flatMap((a) => a.properties);
    await mapWithLimit(all, 5, async (p) => {
      const cachedDetail = detailCache.get(p.propertyId);
      if (cachedDetail) {
        p.timeZone = cachedDetail.timeZone;
        p.currencyCode = cachedDetail.currencyCode;
        return;
      }
      try {
        const detail = (await adminGet(
          `/properties/${p.propertyId}`,
          accessToken,
          "reading property details"
        )) as PropertyDetail;
        detailCache.set(p.propertyId, {
          timeZone: detail.timeZone,
          currencyCode: detail.currencyCode,
        });
        p.timeZone = detail.timeZone;
        p.currencyCode = detail.currencyCode;
      } catch {
        // Non-fatal: list the property without time zone / currency.
      }
    });
  }

  const result: PropertiesResponse = {
    demo: false,
    // Largest accounts first (most sites), then alphabetical — surfaces the
    // primary account (the one with the most sites) at the top of the picker
    // and the Sites page.
    accounts: [...accounts.values()].sort(
      (a, b) =>
        b.properties.length - a.properties.length || a.accountName.localeCompare(b.accountName)
    ),
  };
  summariesCache.set(storeKey, result);
  return result;
}
