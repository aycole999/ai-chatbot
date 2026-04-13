"use client";

import { motion } from "framer-motion";
import { FileText, MicIcon, PaperclipIcon } from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useLegalChat } from "@/hooks/use-legal-chat";
import { buildCurrentEmbedSourceRequestHeaders } from "@/lib/legal/embed-source";
import type {
  DocumentTypeOption,
  FillQuestion,
  LegalAttachment,
  LegalCompletedDocument,
  LegalDisplayConfig,
  LegalMessage,
  LegalStep,
  PreQuestion,
  PreQuestionRecommendation,
  SupplementField,
} from "@/lib/legal/types";
import { cn } from "@/lib/utils";
import { Response } from "../elements/response";
import { SparklesIcon, StopIcon } from "../icons";
import { PreviewAttachment } from "../preview-attachment";
import { Button } from "../ui/button";
import { ImagePreview } from "../ui/image-preview";
import { Textarea } from "../ui/textarea";
import { AttachmentAnalysisCard } from "./attachment-analysis";
import { ConsultationActionBar } from "./consultation-action-bar";
import {
  CompletedDocument,
  FillQuestionsForm,
  FillQuestionsSubmitted,
  LaborContractCheck,
  PreQuestionsForm,
  PreQuestionsSubmitted,
  SessionClosedBanner,
  SupplementForm,
  SupplementSubmitted,
} from "./step-renderers";
import { InlineVoiceRecorder, useVoiceInput } from "./voice-input";

const LEGAL_UPLOAD_ALLOWED_EXTENSIONS = new Set([
  "bmp",
  "gif",
  "jpg",
  "jpeg",
  "png",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "html",
  "htm",
  "txt",
  "rar",
  "zip",
  "gz",
  "bz2",
  "mp3",
  "mp4",
  "avi",
  "rmvb",
  "pdf",
]);

function getFileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function decodeDownloadHeaderValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getDocumentDownloadRequestUrl(
  documentId: string,
  downloadUrl?: string
): string {
  if (documentId.trim()) {
    return `/api/document/download/${encodeURIComponent(documentId)}`;
  }

  return downloadUrl?.trim() || "";
}

function getDocumentDownloadHeaders(
  embedSessionToken: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "x-embed-session-token": embedSessionToken,
  };

  return {
    ...headers,
    ...buildCurrentEmbedSourceRequestHeaders(),
  };
}

function getDownloadFileName(headers: Headers, documentId: string): string {
  const downloadFileName = headers.get("download-filename");
  if (downloadFileName?.trim()) {
    return decodeDownloadHeaderValue(downloadFileName.trim());
  }

  const contentDisposition = headers.get("content-disposition") || "";
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeDownloadHeaderValue(utf8Match[1]);
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return `${documentId || "document"}.docx`;
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

type UploadCredentialVo = {
  ossId: string;
  url: string;
  fileName: string;
  fileSize: number;
  contentType: string;
};

const AUTO_SCROLL_THRESHOLD_PX = 96;
const DEFAULT_LEGAL_DISPLAY_CONFIG: LegalDisplayConfig = {
  title: "法律文书助手 Pro",
  description:
    "描述您的案件细节，我将为您提供法律分析，并自动构建符合法院要求的专业法律文书。",
};

// ============================================================
// 法律聊天欢迎语
// ============================================================
function LegalGreeting() {
  const [displayConfig, setDisplayConfig] = useState<LegalDisplayConfig>(
    DEFAULT_LEGAL_DISPLAY_CONFIG
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadDisplayConfig = async () => {
      try {
        const response = await fetch("/api/legal/display/current", {
          headers: buildCurrentEmbedSourceRequestHeaders(),
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as Partial<LegalDisplayConfig>;

        setDisplayConfig({
          title: data.title?.trim() || DEFAULT_LEGAL_DISPLAY_CONFIG.title,
          description:
            data.description?.trim() ||
            DEFAULT_LEGAL_DISPLAY_CONFIG.description,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
      }
    };

    loadDisplayConfig().catch(() => undefined);

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div
      className="mx-auto mt-8 flex size-full max-w-3xl flex-col items-center justify-center px-4 text-center md:mt-20 md:px-8"
      key="legal-overview"
    >
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/20"
        initial={{ opacity: 0, scale: 0.9 }}
      >
        <SparklesIcon className="text-white" size={32} />
      </motion.div>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="font-black text-3xl md:text-4xl tracking-tight text-foreground"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.2 }}
      >
        {displayConfig.title}
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 max-w-lg text-lg text-muted-foreground leading-relaxed"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.3 }}
      >
        {displayConfig.description}
      </motion.div>

      {/* <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left"
      >
        {[
          { icon: <FileText className="size-5" />, label: "劳动仲裁申请", desc: "未签合同、欠薪、非法裁员" },
          { icon: <FileText className="size-5" />, label: "民事起诉状", desc: "合同纠纷、侵权损害赔偿" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border bg-muted/30 p-4 hover:bg-muted/50 transition-colors cursor-pointer group">
            <div className="size-10 rounded-xl bg-background border flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-sm">
              {item.icon}
            </div>
            <div>
              <div className="font-bold text-sm">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.desc}</div>
            </div>
          </div>
        ))}
      </motion.div> */}
    </div>
  );
}

function StreamingDots() {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:180ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:360ms]" />
    </span>
  );
}

function getStreamingHeaderLabel(step?: LegalStep) {
  if (step === "generate_document") {
    return "正在生成";
  }

  return "生成中";
}

function getStreamingFooterLabel(step?: LegalStep) {
  if (step === "generate_document") {
    return "正在生成文书内容";
  }

  return null;
}

// ============================================================
// 单条消息组件
// ============================================================
function LegalMessageItem({
  message,
  isStreaming,
  showConsultationActionBar,
  canGenerateDocument,
  isActionLoading,
  onGenerateDocument,
  onUploadFile,
  isUploading,
}: {
  message: LegalMessage;
  isStreaming?: boolean;
  showConsultationActionBar?: boolean;
  canGenerateDocument?: boolean;
  isActionLoading?: boolean;
  onGenerateDocument?: () => void;
  onUploadFile?: () => void;
  isUploading?: boolean;
}) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isFormSubmissionMessage = message.type === "form_submission";
  const hasMessageContent = message.content.trim().length > 0;
  const isAssistantStreaming = Boolean(
    isAssistant && isStreaming && message.is_streaming
  );
  const streamingHeaderLabel = isAssistantStreaming
    ? getStreamingHeaderLabel(message.step)
    : null;
  const streamingFooterLabel = isAssistantStreaming
    ? getStreamingFooterLabel(message.step)
    : null;

  return (
    <div
      className="group/message fade-in w-full animate-in duration-300"
      data-role={message.role}
    >
      <div
        className={cn("flex w-full items-start gap-4", {
          "flex-row-reverse": isUser,
        })}
      >
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors",
            {
              "bg-primary text-primary-foreground border-primary/20": isUser,
              "bg-background text-primary border-border": !isUser,
            }
          )}
        >
          {isUser ? (
            <span className="text-[10px] font-bold">ME</span>
          ) : (
            <SparklesIcon size={16} />
          )}
        </div>

        <div
          className={cn("flex flex-col gap-2 transition-all", {
            "items-end max-w-[85%]": isUser,
            "items-start w-full": !isUser,
          })}
        >
          {streamingHeaderLabel && (
            <div className="flex items-center gap-2 px-1 text-[11px] font-medium text-muted-foreground">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/20 px-2.5 py-1">
                <span className="text-foreground/80">
                  {streamingHeaderLabel}
                </span>
                <span className="text-primary/80">
                  <StreamingDots />
                </span>
              </div>
            </div>
          )}

          {/* 用户附件 */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((attachment) => {
                const imageUrl = attachment.file_url || attachment.local_url;
                const isImage = attachment.content_type.startsWith("image/");

                if (isImage && imageUrl) {
                  return (
                    <ImagePreview
                      alt={attachment.file_name}
                      key={attachment.oss_id}
                      src={imageUrl}
                    />
                  );
                }

                return (
                  <div
                    className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm shadow-sm"
                    key={attachment.oss_id}
                  >
                    <FileText className="size-4 text-primary" />
                    {attachment.file_name}
                  </div>
                );
              })}
            </div>
          )}

          {/* 消息内容 */}
          {(!isUser || (message.type === "text" && hasMessageContent)) && (
            <div
              className={cn(
                "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed transition-all",
                {
                  "bg-primary text-primary-foreground shadow-lg shadow-primary/10":
                    isUser,
                  "bg-transparent px-0 py-1": !isUser,
                }
              )}
            >
              {isUser ? (
                message.content
              ) : (
                <div className="prose prose-zinc dark:prose-invert prose-headings:font-bold prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-7 max-w-none">
                  <Response isStreaming={isAssistantStreaming}>
                    {message.content}
                  </Response>
                </div>
              )}
            </div>
          )}

          {streamingFooterLabel && (
            <div className="ml-1 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="text-primary/80">
                <StreamingDots />
              </span>
              <span>{streamingFooterLabel}</span>
            </div>
          )}

          {/* 已提交表单（只读） */}
          {isUser &&
            isFormSubmissionMessage &&
            message.formData?.type === "pre_questions" && (
              <PreQuestionsSubmitted
                answers={message.formData.answers}
                questions={message.formData.questions}
                selectedTypeLabel={message.formData.selectedTypeLabel}
              />
            )}
          {isUser &&
            isFormSubmissionMessage &&
            message.formData?.type === "fill_questions" && (
              <FillQuestionsSubmitted
                questions={message.formData.questions}
                values={message.formData.values}
              />
            )}
          {isUser &&
            isFormSubmissionMessage &&
            message.formData?.type === "supplement_info" && (
              <SupplementSubmitted
                fields={message.formData.fields}
                values={message.formData.values}
              />
            )}

          {/* 附件分析结果 */}
          {message.data?.attachment_analysis &&
            message.data.attachment_analysis.length > 0 && (
              <div className="space-y-2">
                {message.data.attachment_analysis.map((analysis) => (
                  <AttachmentAnalysisCard
                    analysis={analysis}
                    key={analysis.attachment_id}
                  />
                ))}
              </div>
            )}

          {showConsultationActionBar &&
            onGenerateDocument &&
            onUploadFile &&
            !isAssistantStreaming &&
            !isUser && (
              <ConsultationActionBar
                canGenerate={canGenerateDocument}
                isLoading={isActionLoading}
                isUploading={isUploading}
                onGenerate={onGenerateDocument}
                onUpload={onUploadFile}
              />
            )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 思考中状态
// ============================================================
function ThinkingIndicator() {
  return (
    <div
      className="group/message fade-in w-full animate-in duration-500"
      data-role="assistant"
    >
      <div className="flex items-start justify-start gap-4">
        <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-primary shadow-sm">
          <div className="animate-spin-slow">
            <SparklesIcon size={16} />
          </div>
        </div>

        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center gap-3 px-1 pt-2.5">
            <div className="flex gap-1.5">
              <span className="size-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-primary/70 animate-pulse">
              正在检索法律依据...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 根据 step 渲染特定的交互组件
// ============================================================
interface StepInteractionProps {
  currentStep: LegalStep;
  // State props
  canSkipContract: boolean;
  supplementFields: SupplementField[];
  preQuestions: PreQuestion[];
  fillQuestions: FillQuestion[];
  documentTypes: DocumentTypeOption[];
  templateId: string | null;
  completedDocument?: LegalCompletedDocument;
  isLoading: boolean;
  // Action props
  onContractCheck: (hasContract: boolean) => void;
  onSkipContract: () => void;
  onSubmitSupplement: (
    fields: SupplementField[],
    values: Record<string, string>
  ) => void;
  onSubmitFillQuestions: (
    questions: FillQuestion[],
    values: Record<string, string>
  ) => void;
  onSubmitPreQuestions: (
    templateId: string,
    answers: Record<string, string>,
    questions: PreQuestion[],
    selectedType: string,
    selectedTypeLabel: string
  ) => void;
  onRecommendPreQuestionDocumentType: (
    templateId: string,
    answers: Record<string, string>,
    signal?: AbortSignal
  ) => Promise<PreQuestionRecommendation>;
  onDownloadCompletedDocument: (
    documentId: string,
    downloadUrl?: string
  ) => Promise<void>;
  onClose: () => void;
  onReset: () => void;
}

function StepInteraction({
  currentStep,
  canSkipContract,
  supplementFields,
  preQuestions,
  fillQuestions,
  documentTypes,
  templateId,
  completedDocument,
  isLoading,
  onContractCheck,
  onSkipContract,
  onSubmitSupplement,
  onSubmitFillQuestions,
  onSubmitPreQuestions,
  onRecommendPreQuestionDocumentType,
  onDownloadCompletedDocument,
  onClose,
  onReset,
}: StepInteractionProps) {
  // 根据 currentStep 返回对应的交互组件
  switch (currentStep) {
    case "fill_questions":
      // 填充问题表单
      if (fillQuestions.length > 0) {
        return (
          <FillQuestionsForm
            isLoading={isLoading}
            onSubmit={onSubmitFillQuestions}
            questions={fillQuestions}
          />
        );
      }
      return null;

    case "check_labor_contract":
      // 劳动合同检查
      return (
        <LaborContractCheck
          canSkip={canSkipContract}
          isLoading={isLoading}
          message="请确认您是否有劳动合同"
          onConfirm={onContractCheck}
          onSkip={onSkipContract}
        />
      );

    case "supplement_info":
      // 补充信息表单
      if (supplementFields.length > 0) {
        return (
          <SupplementForm
            fields={supplementFields}
            isLoading={isLoading}
            onSubmit={onSubmitSupplement}
          />
        );
      }
      return null;

    case "pre_questions":
      // 问卷表单阶段
      if (preQuestions.length > 0 && templateId) {
        return (
          <PreQuestionsForm
            documentTypes={documentTypes}
            isLoading={isLoading}
            onRecommend={onRecommendPreQuestionDocumentType}
            onSubmit={onSubmitPreQuestions}
            questions={preQuestions}
            templateId={templateId}
          />
        );
      }
      return null;

    case "completed":
      // 完成状态
      if (completedDocument) {
        return (
          <CompletedDocument
            canDownload={completedDocument.can_download}
            content={completedDocument.content}
            docType={completedDocument.doc_type}
            downloadUrl={completedDocument.download_url}
            errorMessage={completedDocument.document_error}
            isLoading={isLoading}
            onClose={onClose}
            onDownload={() =>
              onDownloadCompletedDocument(
                completedDocument.document_id,
                completedDocument.download_url
              )
            }
            onReset={onReset}
          />
        );
      }
      return null;

    case "session_closed":
      return <SessionClosedBanner onReset={onReset} />;

    default:
      return null;
  }
}

// ============================================================
// 主聊天组件
// ============================================================
export function LegalChat() {
  const {
    // 状态
    currentStep,
    messages,
    isLoading,
    isStreaming,
    error,
    // 各阶段专属状态
    canGenerateDocument,
    canSkipContract,
    supplementFields,
    preQuestions,
    fillQuestions,
    documentTypes,
    templateId,
    completedDocument,
    // 方法
    sendMessage,
    skipContractCheck,
    submitFillQuestions,
    submitSupplementInfo,
    generateDocument,
    submitPreQuestions,
    recommendPreQuestionDocumentType,
    closeSession,
    stopStream,
    reset,
    ensureSessionReady,
  } = useLegalChat();

  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState<LegalAttachment[]>([]);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const syncAutoScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      shouldAutoScrollRef.current = true;
      return;
    }

    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceToBottom <= AUTO_SCROLL_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  const handleScroll = useCallback(() => {
    syncAutoScrollState();
  }, [syncAutoScrollState]);

  const clearComposer = useCallback(() => {
    setInputValue("");
    setUploadQueue([]);
    setAttachments((prev) => {
      for (const attachment of prev) {
        if (attachment.local_url) {
          URL.revokeObjectURL(attachment.local_url);
        }
      }
      return [];
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const startNewSession = useCallback(() => {
    shouldAutoScrollRef.current = true;
    clearComposer();
    reset();
  }, [clearComposer, reset]);

  // 监听新建会话事件
  useEffect(() => {
    const handleNewSession = () => {
      startNewSession();
    };

    window.addEventListener("legal-new-session", handleNewSession);
    return () => {
      window.removeEventListener("legal-new-session", handleNewSession);
    };
  }, [startNewSession]);

  // 仅在用户仍停留在底部附近时自动跟随输出，避免流式回复期间抢走滚动位置
  // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖消息和加载状态触发滚动同步
  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      scrollToBottom(isStreaming ? "auto" : "smooth");
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [messages, currentStep, isLoading, isStreaming, error, scrollToBottom]);

  // 发送消息
  const handleSend = async () => {
    const trimmedValue = inputValue.trim();
    if (
      (!trimmedValue && attachments.length === 0) ||
      isLoading ||
      isStreaming
    ) {
      return;
    }

    shouldAutoScrollRef.current = true;
    setInputValue("");
    await sendMessage(
      trimmedValue,
      attachments.length > 0 ? attachments : undefined
    );
    for (const a of attachments) {
      if (a.local_url) {
        URL.revokeObjectURL(a.local_url);
      }
    }
    setAttachments([]);
  };

  // 上传文件到 Legal Upload（写入 OSS，返回 ossId/url）
  const uploadFilesToLegalUpload = useCallback(
    async (files: File[]): Promise<LegalAttachment[]> => {
      const { embedSessionToken } = await ensureSessionReady();

      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file, file.name);
      }

      const headers: Record<string, string> = {};
      if (embedSessionToken) {
        headers["x-embed-session-token"] = embedSessionToken;
      }

      const response = await fetch("/api/legal/upload", {
        method: "POST",
        headers: {
          ...headers,
          ...buildCurrentEmbedSourceRequestHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any).error || "上传失败");
      }

      const uploaded: UploadCredentialVo[] = await response.json();
      const byName = new Map(uploaded.map((u) => [u.fileName, u]));

      const list: LegalAttachment[] = [];
      for (const file of files) {
        const u = byName.get(file.name);
        if (!u?.ossId) {
          continue;
        }
        list.push({
          oss_id: u.ossId,
          file_name: u.fileName || file.name,
          content_type:
            u.contentType || file.type || "application/octet-stream",
          file_size: u.fileSize ?? file.size,
          local_url: URL.createObjectURL(file),
          file_url: u.url,
        });
      }
      return list;
    },
    [ensureSessionReady]
  );

  // 处理文件选择
  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const rawFiles = Array.from(event.target.files || []);
      const files = rawFiles.filter((f) =>
        LEGAL_UPLOAD_ALLOWED_EXTENSIONS.has(getFileExtension(f.name))
      );
      if (files.length === 0) {
        toast.error("不支持的文件类型");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      setUploadQueue(files.map((f) => f.name));

      try {
        if (files.length !== rawFiles.length) {
          toast.error("存在不支持的文件类型，已自动忽略");
        }

        const uploadedAttachments = await uploadFilesToLegalUpload(files);
        if (uploadedAttachments.length > 0) {
          setAttachments((prev) => [...prev, ...uploadedAttachments]);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "上传失败");
      } finally {
        setUploadQueue([]);
        // 重置 input 以允许重复选择相同文件
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [uploadFilesToLegalUpload]
  );

  // 移除附件
  const removeAttachment = useCallback((ossId: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.oss_id === ossId);
      // 释放本地 Object URL
      if (attachment?.local_url) {
        URL.revokeObjectURL(attachment.local_url);
      }
      return prev.filter((a) => a.oss_id !== ossId);
    });
  }, []);

  const downloadCompletedDocument = useCallback(
    async (documentId: string, downloadUrl?: string) => {
      const requestUrl = getDocumentDownloadRequestUrl(documentId, downloadUrl);
      if (!requestUrl) {
        toast.error("当前没有可下载的文书文件");
        return;
      }

      try {
        const { embedSessionToken } = await ensureSessionReady();
        const response = await fetch(requestUrl, {
          method: "GET",
          headers: getDocumentDownloadHeaders(embedSessionToken),
          cache: "no-store",
        });

        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const errorData = (await response.json().catch(() => ({}))) as {
              error?: string;
              msg?: string;
            };
            throw new Error(
              errorData.error || errorData.msg || "文书下载失败，请稍后重试"
            );
          }

          const text = await response.text().catch(() => "");
          throw new Error(text || "文书下载失败，请稍后重试");
        }

        const blob = await response.blob();
        const fileName = getDownloadFileName(response.headers, documentId);
        triggerBrowserDownload(blob, fileName);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "文书下载失败，请稍后重试"
        );
      }
    },
    [ensureSessionReady]
  );

  // 语音录制完成后处理（只填充文本，不添加附件）
  const handleVoiceRecordingComplete = useCallback(
    async (blob: Blob, _duration: number) => {
      try {
        const { embedSessionToken } = await ensureSessionReady();

        const file = new File([blob], `voice_${Date.now()}.webm`, {
          type: blob.type,
        });

        const formData = new FormData();
        formData.append("file", file);

        const headers: Record<string, string> = {};
        if (embedSessionToken) {
          headers["x-embed-session-token"] = embedSessionToken;
        }

        const response = await fetch("/api/legal/voice", {
          method: "POST",
          headers: {
            ...headers,
            ...buildCurrentEmbedSourceRequestHeaders(),
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          toast.error(
            (errorData as { error?: string }).error || "语音识别失败"
          );
          return;
        }

        const data = (await response.json()) as { text: string };

        if (data.text) {
          setInputValue((prev) => (prev ? `${prev} ${data.text}` : data.text));
        } else {
          toast.error("语音识别未返回结果");
        }
      } catch {
        toast.error("语音识别失败");
      }
    },
    [ensureSessionReady]
  );

  // 使用语音输入 hook
  const {
    isRecordingMode,
    isRecording: isVoiceRecording,
    startRecording: startVoiceRecording,
    cancelRecording: cancelVoiceRecording,
    confirmRecording: confirmVoiceRecording,
    hasPermission: voicePermission,
  } = useVoiceInput(handleVoiceRecordingComplete);

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 处理劳动合同检查
  const handleContractCheck = useCallback(
    async (hasContract: boolean) => {
      await sendMessage(hasContract ? "有劳动合同" : "没有劳动合同");
    },
    [sendMessage]
  );

  const openFilePicker = useCallback(() => {
    if (isLoading || isStreaming) {
      return;
    }

    fileInputRef.current?.click();
  }, [isLoading, isStreaming]);

  // 显示输入区域的条件
  const showInput = currentStep === "greeting" || currentStep === "consulting";
  const showConsultationActionBar =
    currentStep === "consulting" && canGenerateDocument;

  let lastAssistantMessageId: string | null = null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      lastAssistantMessageId = messages[index]?.id || null;
      break;
    }
  }

  // 是否显示交互组件
  const showStepInteraction = currentStep !== "greeting";

  return (
    <div className="flex h-full flex-col">
      {/* 消息列表 */}
      <div
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
        ref={scrollContainerRef}
      >
        <div className="mx-auto max-w-3xl px-4 py-4">
          {/* 空状态 */}
          {messages.length === 0 && !isLoading && <LegalGreeting />}

          {/* 消息列表 */}
          <div className="space-y-4">
            {messages.map((message) => (
              <LegalMessageItem
                canGenerateDocument={canGenerateDocument}
                isActionLoading={isLoading}
                isStreaming={isStreaming}
                isUploading={uploadQueue.length > 0}
                key={message.id}
                message={message}
                onGenerateDocument={generateDocument}
                onUploadFile={openFilePicker}
                showConsultationActionBar={
                  showConsultationActionBar &&
                  message.id === lastAssistantMessageId
                }
              />
            ))}

            {/* 加载状态 */}
            {isLoading && !isStreaming && <ThinkingIndicator />}

            {/* 错误信息 */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-800 dark:bg-red-950/50">
                {error}
              </div>
            )}

            {/* 阶段专属交互组件 */}
            {showStepInteraction && (
              <StepInteraction
                canSkipContract={canSkipContract}
                completedDocument={completedDocument}
                currentStep={currentStep}
                documentTypes={documentTypes}
                fillQuestions={fillQuestions}
                isLoading={isLoading}
                onClose={closeSession}
                onContractCheck={handleContractCheck}
                onDownloadCompletedDocument={downloadCompletedDocument}
                onRecommendPreQuestionDocumentType={
                  recommendPreQuestionDocumentType
                }
                onReset={startNewSession}
                onSkipContract={skipContractCheck}
                onSubmitFillQuestions={submitFillQuestions}
                onSubmitPreQuestions={submitPreQuestions}
                onSubmitSupplement={submitSupplementInfo}
                preQuestions={preQuestions}
                supplementFields={supplementFields}
                templateId={templateId}
              />
            )}
          </div>
        </div>
      </div>

      {/* 输入区域 */}
      {showInput && (
        <div className="bg-background px-4 pb-6 pt-2">
          <div className="mx-auto max-w-3xl">
            <div className="relative flex flex-col rounded-2xl border bg-muted/20 p-2 shadow-sm ring-1 ring-border/50 focus-within:bg-background focus-within:ring-primary/20 focus-within:shadow-md transition-all duration-200">
              {/* 隐藏的文件输入 */}
              <input
                accept=".bmp,.gif,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.html,.htm,.txt,.rar,.zip,.gz,.bz2,.mp3,.mp4,.avi,.rmvb,.pdf"
                className="hidden"
                multiple
                onChange={handleFileChange}
                ref={fileInputRef}
                type="file"
              />

              {/* 附件预览区域 */}
              {(attachments.length > 0 || uploadQueue.length > 0) && (
                <div className="mb-2 flex flex-wrap gap-2 px-2 pt-2">
                  {attachments.map((attachment) => (
                    <div className="group relative" key={attachment.oss_id}>
                      <PreviewAttachment
                        attachment={{
                          url:
                            attachment.local_url || attachment.file_url || "",
                          name: attachment.file_name,
                          contentType: attachment.content_type,
                        }}
                        onRemove={() => removeAttachment(attachment.oss_id)}
                      />
                    </div>
                  ))}
                  {uploadQueue.map((fileName) => (
                    <PreviewAttachment
                      attachment={{
                        url: "",
                        name: fileName,
                        contentType: "",
                      }}
                      isUploading={true}
                      key={fileName}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                {isRecordingMode ? (
                  <div className="flex-1 px-2">
                    <InlineVoiceRecorder
                      disabled={isLoading || isStreaming}
                      isRecording={isVoiceRecording}
                      onCancel={cancelVoiceRecording}
                      onConfirm={confirmVoiceRecording}
                    />
                  </div>
                ) : (
                  <Textarea
                    className="min-h-[44px] max-h-[200px] border-none bg-transparent px-3 py-3 focus-visible:ring-0 resize-none text-[15px]"
                    disabled={isLoading || isStreaming}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="请描述您的法律问题..."
                    ref={textareaRef}
                    rows={1}
                    value={inputValue}
                  />
                )}

                {!isRecordingMode && (
                  <div className="flex items-center gap-1 p-1">
                    <Button
                      className="size-8 hover:bg-muted"
                      disabled={isLoading || isStreaming}
                      onClick={openFilePicker}
                      size="icon"
                      title="上传附件"
                      variant="ghost"
                    >
                      <PaperclipIcon className="size-4 text-muted-foreground" />
                    </Button>

                    {/* 语音输入按钮 */}
                    <Button
                      className="size-8 hover:bg-muted"
                      disabled={
                        isLoading || isStreaming || voicePermission === false
                      }
                      onClick={startVoiceRecording}
                      size="icon"
                      title={
                        voicePermission === false
                          ? "麦克风权限被拒绝"
                          : "语音输入"
                      }
                      variant="ghost"
                    >
                      <MicIcon
                        className={cn(
                          "size-4 text-muted-foreground",
                          voicePermission === false && "opacity-50"
                        )}
                      />
                    </Button>

                    {isStreaming ? (
                      <Button
                        className="size-8 text-primary hover:bg-primary/10"
                        onClick={stopStream}
                        size="icon"
                        variant="ghost"
                      >
                        <StopIcon size={16} />
                      </Button>
                    ) : (
                      <Button
                        className={cn(
                          "size-8 transition-all",
                          !inputValue.trim() && attachments.length === 0
                            ? "opacity-50"
                            : "bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                        )}
                        disabled={
                          (!inputValue.trim() && attachments.length === 0) ||
                          isLoading
                        }
                        onClick={handleSend}
                        size="icon"
                      >
                        <svg
                          className="size-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M22 2L11 13"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                          />
                          <path
                            d="M22 2L15 22L11 13L2 9L22 2Z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                          />
                        </svg>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 重置按钮 */}
            <div className="mt-3 flex items-center justify-end px-1">
              {messages.length > 0 && (
                <Button
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={startNewSession}
                  size="sm"
                  variant="ghost"
                >
                  清空对话
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 完成状态时的底部操作区 */}
      {currentStep === "completed" && !completedDocument && (
        <div className="border-t bg-background p-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-green-600">文书已生成完成！</p>
            <Button onClick={startNewSession} variant="outline">
              开始新的咨询
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
