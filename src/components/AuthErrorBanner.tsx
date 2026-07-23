"use client";

import { signIn } from "next-auth/react";
import { useReport } from "@/components/report-context";
import { Button } from "@/components/ui/primitives";

/** Shown when the stored Google authorization can no longer be refreshed. */
export function AuthErrorBanner() {
  const { authError, googleConfigured } = useReport();
  if (!authError || !googleConfigured) return null;
  return (
    <div className="no-print flex flex-wrap items-center gap-3 rounded-lg border border-negative/40 bg-negative-soft px-4 py-3 text-sm">
      <p className="flex-1 text-negative">
        Your Google authorization expired. Reconnect to keep loading real Analytics data.
      </p>
      <Button size="sm" onClick={() => signIn("google")}>
        Reconnect Google
      </Button>
    </div>
  );
}
