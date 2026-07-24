"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useReport } from "@/components/report-context";
import {
  BlockSkeleton,
  Button,
  Card,
  CardHeader,
  Chip,
  Toggle,
} from "@/components/ui/primitives";

export default function SettingsPage() {
  const {
    configLoaded,
    googleConfigured,
    connected,
    demo,
    demoOptIn,
    setDemoOptIn,
    userEmail,
    authError,
  } = useReport();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const disconnect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/google/disconnect", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { revoked?: boolean };
      setMessage(
        data.revoked
          ? "Access revoked with Google. Signing out…"
          : "Signed out. Google could not confirm revocation — you can also remove access from your Google Account permissions page."
      );
      await signOut({ redirect: false });
    } catch {
      setMessage("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!configLoaded) return <BlockSkeleton />;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-2xl tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted">
          Manage the Google connection, demo mode, and see how this app handles your data.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Google connection"
          right={
            connected ? (
              <Chip tone={authError ? "negative" : "positive"}>
                {authError ? "Needs reconnect" : "Connected"}
              </Chip>
            ) : (
              <Chip tone="neutral">Not connected</Chip>
            )
          }
        />
        <div className="space-y-3 p-5 text-sm">
          {connected ? (
            <>
              <p className="text-muted">
                Signed in as <span className="font-medium text-ink">{userEmail}</span> with
                read-only Analytics access (
                <span className="font-mono text-xs">analytics.readonly</span>).
              </p>
              {authError ? (
                <p className="text-negative">
                  The stored authorization can no longer be refreshed. Reconnect to resume loading
                  real data.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => signIn("google")}>Reconnect</Button>
                <Button variant="danger" onClick={() => void disconnect()} disabled={busy}>
                  {busy ? "Disconnecting…" : "Disconnect and revoke access"}
                </Button>
              </div>
              <p className="text-xs text-muted">
                Disconnecting revokes the token with Google and clears the session cookie. Nothing
                is retained afterwards.
              </p>
            </>
          ) : googleConfigured ? (
            <>
              <p className="text-muted">
                Connect the Google account that can view your GA4 sites. The app requests
                read-only access and never writes to Analytics.
              </p>
              <Button variant="primary" onClick={() => signIn("google")}>
                Connect with Google
              </Button>
            </>
          ) : (
            <p className="text-muted">
              Google OAuth credentials are not configured on this deployment. Add{" "}
              <span className="font-mono text-xs">GOOGLE_CLIENT_ID</span> and{" "}
              <span className="font-mono text-xs">GOOGLE_CLIENT_SECRET</span> to{" "}
              <span className="font-mono text-xs">.env.local</span> and restart the server. See the
              README for the full Google Cloud walkthrough.
            </p>
          )}
          {message ? <p className="text-xs text-accent-strong">{message}</p> : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Demo mode" />
        <div className="flex items-start justify-between gap-6 p-5 text-sm">
          <div>
            <p className="text-muted">
              Explore the full interface with deterministic sample data across four fixture
              accounts. Demo data is always labelled and is never shown while a real Google account
              is connected.
            </p>
            <p className="mt-2 text-xs text-muted">
              Currently {demo ? "active" : "inactive"}.
              {connected ? " Disconnect Google to browse demo data again." : ""}
            </p>
          </div>
          <Toggle
            checked={demoOptIn}
            onChange={setDemoOptIn}
            label="Use demo data when not connected"
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Data handling" />
        <ul className="space-y-2 p-5 text-sm text-muted">
          <li>
            All Google API calls run server-side in Route Handlers. Access tokens are never sent to
            the browser.
          </li>
          <li>
            The refresh token is encrypted with AES-256-GCM before it is written into the encrypted
            session cookie, and it is decrypted only inside the server runtime.
          </li>
          <li>
            OAuth tokens and secrets are never written to logs or to the report cache. Only
            normalized report responses are cached for five minutes &mdash; in Cloudflare Workers KV
            in production, or in memory locally &mdash; to stay inside Google&apos;s quotas.
          </li>
          <li>
            The requested scope is read-only. The app cannot modify your Analytics configuration or
            data.
          </li>
        </ul>
      </Card>
    </div>
  );
}
