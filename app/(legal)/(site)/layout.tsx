import { Suspense } from "react";
import { LegalLayoutShell } from "@/components/legal/legal-layout-shell";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <LegalLayoutShell>{children}</LegalLayoutShell>
    </Suspense>
  );
}
