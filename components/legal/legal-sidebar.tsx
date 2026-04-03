"use client";

import Link from "next/link";
import { PlusIcon, SparklesIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function LegalSidebar() {
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="group-data-[side=left]:border-r border-border/50 bg-sidebar/50 backdrop-blur-xl">
      <SidebarHeader className="border-b border-border/50 px-4 py-6">
        <SidebarMenu>
          <div className="flex flex-col gap-4">
            <Link
              className="group flex flex-row items-center gap-3 transition-all"
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20 ring-1 ring-primary/20 transition-transform group-hover:scale-105">
                <SparklesIcon className="text-primary-foreground" size={20} />
              </div>
              <span className="font-bold text-lg tracking-tight">
                法律文书助手
              </span>
            </Link>
            
            <Button
              className="w-full justify-start gap-2 rounded-xl border-dashed bg-primary/5 px-4 py-6 text-primary hover:bg-primary/10 hover:text-primary transition-all active:scale-[0.98]"
              onClick={() => {
                setOpenMobile(false);
                window.dispatchEvent(new CustomEvent("legal-new-session"));
              }}
              variant="outline"
            >
              <PlusIcon className="size-4" />
              <span className="font-medium">新建法律咨询</span>
            </Button>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted/50 text-muted-foreground/40">
                <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </div>
              <div className="max-w-[160px] space-y-1">
                <p className="font-medium text-muted-foreground text-sm">暂无历史记录</p>
                <p className="text-muted-foreground/60 text-xs">
                  咨询会话暂未启用持久化存储
                </p>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/50 p-4">
        <div className="rounded-xl bg-muted/30 p-3 text-[11px] text-muted-foreground/60 leading-relaxed italic">
          注：本助手仅提供文书辅助生成，不构成正式法律建议。
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
