import type { PropertiesResponse, PropertySummary } from "../types";

/**
 * Demo-mode fixtures only. Real account and property names are always loaded
 * dynamically from the Google Analytics Admin API — nothing here is used when
 * a Google account is connected.
 */

type Fixture = PropertySummary & { baseDailyUsers: number; hasRevenue: boolean };

export const DEMO_PROPERTIES: Fixture[] = [
  {
    accountId: "101",
    accountName: "Colma GA Acct",
    propertyId: "301442718",
    propertyName: "Colma Blue Site",
    timeZone: "America/New_York",
    currencyCode: "USD",
    baseDailyUsers: 420,
    hasRevenue: true,
  },
  {
    accountId: "101",
    accountName: "Colma GA Acct",
    propertyId: "498220154",
    propertyName: "Colma Brain App",
    timeZone: "America/New_York",
    currencyCode: "USD",
    baseDailyUsers: 180,
    hasRevenue: false,
  },
  {
    accountId: "102",
    accountName: "Colma.Com",
    propertyId: "287119406",
    propertyName: "Colma.com Marketing",
    timeZone: "America/New_York",
    currencyCode: "USD",
    baseDailyUsers: 930,
    hasRevenue: true,
  },
  {
    accountId: "103",
    accountName: "Memorial Stores",
    propertyId: "352998411",
    propertyName: "Memorial Stores Storefront",
    timeZone: "America/Chicago",
    currencyCode: "USD",
    baseDailyUsers: 1540,
    hasRevenue: true,
  },
  {
    accountId: "103",
    accountName: "Memorial Stores",
    propertyId: "415667209",
    propertyName: "Memorial Stores Blog",
    timeZone: "America/Chicago",
    currencyCode: "USD",
    baseDailyUsers: 260,
    hasRevenue: false,
  },
  {
    accountId: "104",
    accountName: "UPD Urns Current",
    propertyId: "263501877",
    propertyName: "UPD Urns Store",
    timeZone: "America/New_York",
    currencyCode: "USD",
    baseDailyUsers: 690,
    hasRevenue: true,
  },
  {
    accountId: "104",
    accountName: "UPD Urns Current",
    propertyId: "441209563",
    propertyName: "UPD Field Services",
    timeZone: "America/Toronto",
    currencyCode: "CAD",
    baseDailyUsers: 120,
    hasRevenue: true,
  },
];

export function demoPropertiesResponse(): PropertiesResponse {
  const byAccount = new Map<string, { accountId: string; accountName: string; properties: PropertySummary[] }>();
  for (const f of DEMO_PROPERTIES) {
    const acc = byAccount.get(f.accountId) ?? {
      accountId: f.accountId,
      accountName: f.accountName,
      properties: [],
    };
    acc.properties.push({
      propertyId: f.propertyId,
      propertyName: f.propertyName,
      accountId: f.accountId,
      accountName: f.accountName,
      timeZone: f.timeZone,
      currencyCode: f.currencyCode,
    });
    byAccount.set(f.accountId, acc);
  }
  return {
    demo: true,
    // Match the live sort: largest accounts first, then alphabetical.
    accounts: [...byAccount.values()].sort(
      (a, b) =>
        b.properties.length - a.properties.length || a.accountName.localeCompare(b.accountName)
    ),
  };
}

export function demoFixture(propertyId: string): Fixture | undefined {
  return DEMO_PROPERTIES.find((p) => p.propertyId === propertyId);
}
