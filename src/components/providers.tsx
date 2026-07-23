"use client";

import { SessionProvider } from "next-auth/react";
import { ReportProvider } from "./report-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ReportProvider>{children}</ReportProvider>
    </SessionProvider>
  );
}
