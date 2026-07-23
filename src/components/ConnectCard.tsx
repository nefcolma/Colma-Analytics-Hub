"use client";

import { signIn } from "next-auth/react";
import { useReport } from "@/components/report-context";
import { Button, Card } from "@/components/ui/primitives";

/** Shown when OAuth is configured but no Google account is connected yet. */
export function ConnectCard() {
  const { setDemoOptIn, googleConfigured } = useReport();
  return (
    <Card className="mx-auto max-w-lg px-8 py-12 text-center">
      <h2 className="font-display text-2xl tracking-tight">Connect Google Analytics</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted">
        Sign in with the Google account that has access to your Analytics properties. The app
        requests read-only access and detects every GA4 account and property you can view.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        {googleConfigured ? (
          <Button variant="primary" onClick={() => signIn("google")}>
            Connect with Google
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => setDemoOptIn(true)}>
          Explore with demo data
        </Button>
      </div>
      {!googleConfigured ? (
        <p className="mt-4 text-xs text-muted">
          Google OAuth is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to
          .env.local to enable real connections (see the README).
        </p>
      ) : null}
    </Card>
  );
}
