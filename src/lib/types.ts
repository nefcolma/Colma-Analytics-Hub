// Shared types for Colma Analytics Hub

export type PropertySummary = {
  /** Numeric GA4 property ID, e.g. "301442718" */
  propertyId: string;
  propertyName: string;
  /** Numeric account ID */
  accountId: string;
  accountName: string;
  timeZone?: string;
  currencyCode?: string;
};

export type PropertiesResponse = {
  demo: boolean;
  accounts: {
    accountId: string;
    accountName: string;
    properties: PropertySummary[];
  }[];
};

export type PresetId =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "custom";

export type DateRange = { startDate: string; endDate: string };

export type CompareMode = "none" | "previous_period" | "previous_year";

export type RangeSelection = {
  preset: PresetId;
  /** Only used when preset === "custom" (YYYY-MM-DD) */
  start?: string;
  end?: string;
};

export type KpiSet = {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  views: number;
  /** Fraction 0..1 */
  engagementRate: number;
  /** Seconds */
  averageSessionDuration: number;
  keyEvents: number;
  totalRevenue: number;
};

export type TrendPoint = {
  /** YYYYMMDD as returned by GA */
  date: string;
  activeUsers: number;
  sessions: number;
};

export type DimensionRow = {
  key: string;
  /** Secondary label (e.g. page path under page title) */
  detail?: string;
  sessions?: number;
  activeUsers?: number;
  views?: number;
  engagementRate?: number;
  keyEvents?: number;
  /** Revenue attributed to this row (channel/source revenue, item revenue). */
  revenue?: number;
  /** Units sold (items purchased) for product rows. */
  quantity?: number;
};

export type ReportError = {
  code:
    | "unauthenticated"
    | "expired"
    | "permission"
    | "quota"
    | "no_data"
    | "not_found"
    | "network"
    | "unknown";
  message: string;
  retryable: boolean;
};

export type PropertyReport = {
  propertyId: string;
  propertyName: string;
  accountName: string;
  currencyCode: string;
  timeZone: string;
  status: "ok" | "error";
  error?: ReportError;
  hasRevenue: boolean;
  noData: boolean;
  kpis?: { current: KpiSet; previous?: KpiSet };
  trend?: TrendPoint[];
  channels?: DimensionRow[];
  sourceMedium?: DimensionRow[];
  topPages?: DimensionRow[];
  landingPages?: DimensionRow[];
  geography?: DimensionRow[];
  devices?: DimensionRow[];
  /** Best-selling ecommerce items (by item revenue). */
  products?: DimensionRow[];
  /** Active users split into new vs returning. */
  newVsReturning?: DimensionRow[];
};

export type ReportRequest = {
  propertyIds: string[];
  range: DateRange;
  compare: CompareMode;
  demo?: boolean;
};

export type ReportResponse = {
  demo: boolean;
  generatedAt: string;
  range: DateRange;
  compare: CompareMode;
  compareRange?: DateRange;
  properties: PropertyReport[];
};

export type ApiError = { error: ReportError };
