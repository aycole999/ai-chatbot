"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

interface ImagePreviewProps {
  src: string;
  alt: string;
  className?: string;
  thumbnailClassName?: string;
}

/**
 * 图片预览组件
 * 点击缩略图可查看大图
 */
export function ImagePreview({
  src,
  alt,
  className,
  thumbnailClassName,
}: ImagePreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {/* 缩略图触发器 */}
      <DialogPrimitive.Trigger asChild>
        <button
          className={cn(
            "cursor-zoom-in overflow-hidden rounded-lg transition-opacity hover:opacity-90",
            className
          )}
          type="button"
        >
          <img
            alt={alt}
            className={cn("max-h-48 max-w-48 object-cover", thumbnailClassName)}
            src={src}
          />
        </button>
      </DialogPrimitive.Trigger>

      {/* 大图预览 */}
      <DialogPortal>
        <DialogOverlay className="bg-black/90" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogTitle className="sr-only">
            查看图片：{alt}
          </DialogTitle>

          {/* 关闭按钮 */}
          <DialogPrimitive.Close className="absolute -top-10 right-0 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 focus:outline-none">
            <X className="size-6" />
            <span className="sr-only">关闭</span>
          </DialogPrimitive.Close>

          {/* 大图 */}
          <img
            alt={alt}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            src={src}
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
