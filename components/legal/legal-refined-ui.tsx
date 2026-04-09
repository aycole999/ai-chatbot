"use client";

import {
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Printer,
  Sparkles,
} from "lucide-react";
import { forwardRef, type Ref } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

/**
 * 1. 虚拟 A4 文书预览 (DocumentPreview)
 * 模拟纸质文书质感
 */
function normalizeDocumentTitle(value: string): string {
  return value
    .replace(/^#+\s*/g, "")
    .replace(/^\*+\s*/g, "")
    .replace(/\*+$/g, "")
    .trim();
}

function normalizeDocumentPreviewContent(
  content: string,
  title: string
): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return "";
  }

  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines[0]?.trim() || "";
  const normalizedFirstLine = normalizeDocumentTitle(firstLine).replace(
    /\s+/g,
    ""
  );
  const normalizedTitle = normalizeDocumentTitle(title).replace(/\s+/g, "");

  if (
    normalizedFirstLine &&
    normalizedTitle &&
    normalizedFirstLine === normalizedTitle
  ) {
    return lines.slice(1).join("\n").trim();
  }

  return trimmed;
}

const documentContentClass = cn(
  "max-w-none font-serif text-[15px] leading-[1.95] text-zinc-800",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-3 [&_p]:text-zinc-800",
  "[&_ol]:my-4 [&_ol]:pl-6 [&_ul]:my-4 [&_ul]:pl-6",
  "[&_li]:my-2 [&_li]:leading-[1.9]",
  "[&_h1]:my-8 [&_h1]:text-center [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight",
  "[&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-[18px] [&_h2]:font-bold",
  "[&_h3]:mt-7 [&_h3]:mb-3 [&_h3]:text-[16px] [&_h3]:font-semibold",
  "[&_hr]:my-8 [&_hr]:border-zinc-200",
  "[&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-700",
  "[&_strong]:font-semibold [&_em]:italic",
  "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.95em]",
  "[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-zinc-200 [&_pre]:bg-zinc-950 [&_pre]:p-4 [&_pre]:text-zinc-50",
  "[&_table]:my-5 [&_table]:w-full [&_table]:border-collapse",
  "[&_th]:border [&_th]:border-zinc-200 [&_th]:bg-zinc-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border [&_td]:border-zinc-200 [&_td]:px-3 [&_td]:py-2"
);

const DocumentPaper = forwardRef<
  HTMLDivElement,
  {
    title: string;
    content: string;
  }
>(function DocumentPaper({ title, content }, ref: Ref<HTMLDivElement>) {
  const normalizedTitle = normalizeDocumentTitle(title) || "法律文书";
  const previewContent = normalizeDocumentPreviewContent(
    content,
    normalizedTitle
  );

  return (
    <div
      className="relative mx-auto w-full max-w-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5 md:p-12 print:max-w-none print:shadow-none print:ring-0"
      data-document-preview-paper
      ref={ref}
    >
      {/* 文书页眉 */}
      <div className="mb-8 flex items-center justify-between border-b border-zinc-100 pb-4">
        <div className="flex items-center gap-2 opacity-30 grayscale">
          <Sparkles className="size-4" />
          <span className="text-[10px] font-bold tracking-widest uppercase">
            Legal AI Engine
          </span>
        </div>
        <div className="text-[10px] text-zinc-300">CONFIDENTIAL DOCUMENT</div>
      </div>

      <div
        data-document-preview-copy-source
        style={{
          fontFamily: "var(--font-legal-document)",
          fontFeatureSettings: '"lnum" 1, "tnum" 1',
          fontVariantNumeric: "lining-nums tabular-nums",
        }}
      >
        <h1 className="mb-10 text-center text-2xl font-bold tracking-tight text-zinc-900 underline decoration-zinc-200 underline-offset-8">
          {normalizedTitle}
        </h1>

        <Streamdown className={documentContentClass} mode="static">
          {previewContent}
        </Streamdown>

        {/* 签署印章预览 (可选装饰) */}
        <div className="mt-16 flex justify-end px-4">
          <div className="space-y-1 text-right">
            <div className="h-0.5 w-32 bg-zinc-100" />
            <div className="text-[11px] text-zinc-400">申请人 (签章)</div>
            <div className="text-[11px] text-zinc-400">
              日期：{new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* 水印 */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none opacity-[0.03] rotate-12">
        <div className="whitespace-nowrap text-9xl font-black">LEGAL ELITE</div>
      </div>
    </div>
  );
});

DocumentPaper.displayName = "DocumentPaper";

export function DocumentPreview({
  title,
  content,
  canDownload = true,
  onDownload,
  onCopy,
  onPrint,
  onEdit,
  paperRef,
}: {
  title: string;
  content: string;
  canDownload?: boolean;
  onDownload?: () => void;
  onCopy?: () => void;
  onPrint?: () => void;
  onEdit?: () => void;
  paperRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      className="space-y-6 animate-in fade-in zoom-in-95 duration-700"
      data-document-preview-root
    >
      {/* 工具栏 */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-1 print:hidden"
        data-document-preview-toolbar
      >
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              文书生成成功
            </h3>
            <p className="text-[11px] text-muted-foreground">
              请在下方预览、复制、打印或下载 Word
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            className="size-9 rounded-full"
            onClick={onCopy}
            size="icon"
            title="复制全文"
            variant="ghost"
          >
            <Copy className="size-4" />
          </Button>
          <Button
            className="size-9 rounded-full"
            onClick={onEdit}
            size="icon"
            title="在线编辑"
            variant="ghost"
          >
            <Edit3 className="size-4" />
          </Button>
          <Button
            className="size-9 rounded-full"
            onClick={onPrint}
            size="icon"
            title="打印文书"
            variant="ghost"
          >
            <Printer className="size-4" />
          </Button>
          <Button
            className="ml-1 rounded-full border-primary/20 hover:bg-primary/5 text-primary"
            disabled={!canDownload}
            onClick={onDownload}
            size="sm"
            variant="outline"
          >
            <Download className="mr-2 size-4" />
            下载 Word
          </Button>
        </div>
      </div>

      {/* 虚拟纸张 */}
      <div className="relative rounded-xl border bg-zinc-100/50 p-2 shadow-inner md:p-4 print:border-0 print:bg-white print:p-0 print:shadow-none">
        <DocumentPaper content={content} ref={paperRef} title={title} />
      </div>
    </div>
  );
}
