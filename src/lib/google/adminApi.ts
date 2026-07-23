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
  cacheKey: string
): Promise<PropertiesResponse> {
  const cached = summariesCache.get(cacheKey);
  if (cached) return cached;

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

  // Enrich with time zone and currency (Admin API properties.get), limited concurrency.
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

  const result: PropertiesResponse = {
    demo: false,
    accounts: [...accounts.values()].sort((a, b) => a.accountName.localeCompare(b.accountName)),
  };
  summariesCache.set(cacheKey, result);
  return result;
}
