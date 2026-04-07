import { cookies } from "next/headers";
import { use } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ENABLE_LEGAL_SIDEBAR } from "@/lib/legal/ui-config";
import { LegalSidebar } from "./legal-sidebar";

export function LegalLayoutShell({ children }: { children: React.ReactNode }) {
  if (!ENABLE_LEGAL_SIDEBAR) {
    return children;
  }

  const cookieStore = use(cookies());
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <LegalSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
