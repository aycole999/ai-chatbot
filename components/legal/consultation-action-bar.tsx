"use client";

import { motion } from "framer-motion";
import { CircleAlert, FileText, Upload } from "lucide-react";
import { Button } from "../ui/button";

type ConsultationActionBarProps = {
  onGenerate: () => void;
  onUpload: () => void;
  isLoading?: boolean;
  canGenerate?: boolean;
  isUploading?: boolean;
};

export function ConsultationActionBar({
  onGenerate,
  onUpload,
  isLoading,
  canGenerate,
  isUploading = false,
}: ConsultationActionBarProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 w-full max-w-[42rem]"
      initial={{ opacity: 0, y: 8 }}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.045] px-4 py-3 text-primary/90 shadow-[0_10px_24px_rgba(99,102,241,0.06)]">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
            <CircleAlert className="size-4" />
          </div>
          <p className="min-w-0 text-[13px] leading-6 text-zinc-700">
            上传劳动合同、沟通记录等材料后，可帮助我们更准确地梳理事实并生成文书。
            <br />
            您也可以继续咨询，我们会根据您提供的信息尽力为您提供帮助。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            className="h-12 rounded-2xl border border-primary/25 bg-white px-6 text-[15px] font-medium text-primary shadow-[0_4px_14px_rgba(99,102,241,0.08)] transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:border-primary/15 disabled:bg-zinc-50 disabled:text-primary/45"
            disabled={isLoading || isUploading}
            onClick={onUpload}
            size="sm"
            variant="ghost"
          >
            <Upload className="mr-2 size-4" />
            {isUploading ? "上传文件中..." : "上传文件"}
          </Button>
          <Button
            className="h-12 rounded-2xl border border-primary/25 bg-white px-6 text-[15px] font-medium text-primary shadow-[0_4px_14px_rgba(99,102,241,0.08)] transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:border-primary/15 disabled:bg-zinc-50 disabled:text-primary/45"
            disabled={!canGenerate || isLoading || isUploading}
            onClick={onGenerate}
            size="sm"
            variant="ghost"
          >
            <FileText className="mr-2 size-4" />
            {isLoading ? "文书生成中..." : "文书生成"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
