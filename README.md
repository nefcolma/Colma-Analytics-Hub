# Colma Analytics Hub

A multi-property Google Analytics 4 reporting dashboard. Connect one Google
account, discover every GA4 account and property it can read, and generate
consolidated reports across any selection of them.

Built with Next.js (App Router), TypeScript, Tailwind CSS v4, Auth.js, and
Recharts.

---

## Features

- **OAuth connection** to Google with read-only Analytics scope.
- **Automatic property discovery** via the Analytics Admin API, grouped by
  account, with time zone and currency metadata.
- **Consolidated reporting** across up to 25 properties at once, with bounded
  concurrency and per-property failure isolation — one failing property never
  discards the rest of the report.
- **Eight KPIs** with period-over-period comparison: active users, new users,
  sessions, views, engagement rate, average session duration, key events, and
  revenue (shown only when a property reports it).
- **Report sections**: traffic trend (daily/weekly/monthly), traffic acquisition
  by channel group and source/medium, top pages, landing pages, geography, and
  devices.
- **Date presets** — today, yesterday, last 7/30 days, this month, previous
  month, custom — with optional comparison to the previous period or previous
  year.
- **Exports**: summary CSV, per-section CSVs, and a print-ready view for PDF.
- **Demo mode** with deterministic sample data, clearly labelled everywhere it
  appears, so the interface can be explored without connecting an account.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run dev
```

Open <http://localhost:3000>.

Without Google credentials configured, the app starts in **demo mode** — every
screen works against generated sample data, marked with a "Demo data" badge.

---

## Google Cloud setup

You need a Google Cloud project, two enabled APIs, a configured consent screen,
and an OAuth client. Roughly ten minutes end to end.

### 1. Create or select a project

Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a
project (or select an existing one).

### 2. Enable the two required APIs

Under **APIs & Services → Library**, search for and enable **both**:

- **Google Analytics Admin API** — discovers accounts and properties.
- **Google Analytics Data API** — runs the actual reports.

Enabling only one will cause the app to authenticate successfully but fail when
loading properties or generating reports.

### 3. Configure the OAuth consent screen

Under **APIs & Services → OAuth consent screen**:

- **User type**: External (unless everyone is inside a Google Workspace
  organisation, in which case Internal is simpler).
- Fill in the app name, user support email, and developer contact email.
- **Scopes**: add `https://www.googleapis.com/auth/analytics.readonly`. The
  `openid`, `email`, and `profile` scopes are included automatically.

> **If your app is in Testing mode**, only accounts listed as test users can sign
> in. Under **Audience** (or **Test users** in the older console layout), click
> **Add users** and add every Google account that will use the dashboard —
> including your own. Sign-in fails with `access_denied` otherwise.
>
> Testing mode also expires refresh tokens after seven days. That is fine for
> development; publish the app when you want a durable connection.

### 4. Create the OAuth client

Under **APIs & Services → Credentials → Create credentials → OAuth client ID**:

- **Application type**: Web application.
- **Authorized JavaScript origins**:
  - `http://localhost:3000`
  - your production origin, e.g. `https://analytics.example.com`
- **Authorized redirect URIs**:
  - `http://localhost:3000/api/auth/callback/google`
  - your production callback, e.g.
    `https://analytics.example.com/api/auth/callback/google`

These must match exactly — no trailing slashes, and the scheme matters.

Copy the generated client ID and client secret into `.env.local`.

### 5. Grant Analytics access

The connected Google account needs at least **Viewer** access on the GA4
properties you want to report on. Properties the account cannot read simply will
not appear in the property list.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | yes | OAuth client ID from step 4 |
| `GOOGLE_CLIENT_SECRET` | yes | OAuth client secret from step 4 |
| `GOOGLE_REDIRECT_URI` | yes | Must match an authorized redirect URI exactly |
| `SESSION_SECRET` | yes | Signs and encrypts the session cookie |
| `TOKEN_ENCRYPTION_KEY` | no | AES key for the refresh token; derived from `SESSION_SECRET` if unset |
| `NEXTAUTH_URL` | production | Public base URL, needed behind a proxy |
| `DATABASE_URL` | no | Unused; a hook point for future persistence |

Generate secrets with:

```bash
openssl rand -base64 32
```

---

## Scripts

```bash
npm run dev         # development server
npm run build       # production build
npm start           # serve the production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest (single run)
npm run test:watch  # Vitest in watch mode
```

---

## Architecture

```
src/
  app/
    (dashboard)/        Overview, Properties, Reports, Exports, Settings
    print/              Print-ready report view
    api/
      auth/[...nextauth]/  Auth.js handlers
      analytics/properties/ Account + property discovery
      analytics/report/     Report generation
      google/disconnect/    Token revocation
      config/               Public config probe
  components/           UI, shell, controls, charts, tables
  lib/
    google/             Admin API, Data API, token refresh, error mapping
    report/             Aggregation, request validation, fan-out engine
    demo/               Deterministic fixtures and sample reports
```

### Design decisions

**No database.** Sessions are JWT-based. The refresh token is encrypted with
AES-256-GCM and stored inside the already-encrypted session cookie, so there is
no server-side session store to operate or secure. `DATABASE_URL` remains in the
template as a hook point if you later add saved presets or scheduled exports.

**Server-side Google calls only.** Every Analytics request runs in a Route
Handler. Access tokens are never exposed to the browser; the client session
carries only a connection flag and the account email.

**Two HTTP calls per property.** The eight report queries are issued through the
Data API's `batchRunReports` endpoint, split across two batches (five and three)
to stay within the per-request limit.

**Bounded concurrency and caching.** Reports fan out three properties at a time.
Successful property reports are cached in memory for five minutes; account
summaries for five minutes; property detail for thirty. Failures are never
cached, so a retry always re-queries Google.

**Failure isolation.** A property that returns a permission error, quota error,
or timeout is marked failed and surfaced in a banner with a retry action. The
remaining properties still render.

**Retries.** Requests returning 429 or 5xx are retried up to three times with
exponential backoff and jitter, honouring `Retry-After` when present.

**Revenue totals.** Revenue is summed across every property that reports it into
a single figure, labelled with the currency carrying the largest share. If you
report on properties using different currencies, that total combines them
without conversion — worth keeping in mind when selecting a mixed set.

**System fonts.** No webfont dependency — a serif display stack for headings and
the system sans stack for body text.

---

## Tests

135 tests across 12 files, covering date-range resolution and comparison
periods, refresh-token encryption round-trips, retry and backoff behaviour,
concurrency limits, Data API response normalisation (including the
`date_range_0`/`date_range_1` split when comparing), metric aggregation,
request validation, CSV generation and escaping, TTL caching, demo determinism,
and per-property failure isolation.

```bash
npm test
```

---

## Security notes

- The requested scope is read-only; the app cannot modify Analytics data or
  configuration.
- Tokens and Analytics data are never written to logs or to a database.
- **Disconnect** in Settings revokes the grant with Google and clears the
  session cookie.
- Report requests are validated server-side: numeric property IDs only, at most
  25 properties, and date ranges capped at 400 days.
