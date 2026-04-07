"use client";

import { memo } from "react";
import { useWindowSize } from "usehooks-ts";
import { PlusIcon } from "@/components/icons";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { ENABLE_LEGAL_SIDEBAR } from "@/lib/legal/ui-config";

function HeaderWithoutSidebar() {
  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <Button
        className="h-8 px-2 md:h-fit md:px-2"
        onClick={() => {
          // 触发自定义事件，通知 LegalChat 重置会话
          window.dispatchEvent(new CustomEvent("legal-new-session"));
        }}
        variant="outline"
      >
        <PlusIcon />
        <span className="md:sr-only">新建咨询</span>
      </Button>
    </header>
  );
}

function HeaderWithSidebar() {
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />

      {(!open || windowWidth < 768) && (
        <Button
          className="h-8 px-2 md:h-fit md:px-2"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("legal-new-session"));
          }}
          variant="outline"
        >
          <PlusIcon />
          <span className="md:sr-only">新建咨询</span>
        </Button>
      )}
    </header>
  );
}

function PureLegalChatHeader() {
  if (!ENABLE_LEGAL_SIDEBAR) {
    return <HeaderWithoutSidebar />;
  }

  return <HeaderWithSidebar />;
}

export const LegalChatHeader = memo(PureLegalChatHeader);
