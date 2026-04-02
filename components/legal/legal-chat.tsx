"use client";

import { motion } from "framer-motion";
import { MicIcon, PaperclipIcon } from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useLegalChat } from "@/hooks/use-legal-chat";
import type {
  FillQuestion,
  LegalAttachment,
  LegalMessage,
  LegalStep,
  PreQuestion,
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

type UploadCredentialVo = {
  ossId: string;
  url: string;
  fileName: string;
  fileSize: number;
  contentType: string;
};

// ============================================================
// 法律聊天欢迎语
// ============================================================
function LegalGreeting() {
  return (
    <div
      className="mx-auto mt-4 flex size-full max-w-3xl flex-col justify-center px-4 md:mt-16 md:px-8"
      key="legal-overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="font-semibold text-xl md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        法律文书助手
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-xl text-zinc-500 md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        请描述您遇到的法律问题，我将帮您生成相应的法律文书。
      </motion.div>
    </div>
  );
}

// ============================================================
// 单条消息组件
// ============================================================
function LegalMessageItem({
  message,
  isStreaming,
}: {
  message: LegalMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className="group/message fade-in w-full animate-in duration-200"
      data-role={message.role}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": isUser,
          "justify-start": !isUser,
        })}
      >
        {!isUser && (
          <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div
          className={cn("flex flex-col gap-2", {
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]": isUser,
            "w-full": !isUser,
          })}
        >
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

                // 非图片文件显示文件名
                return (
                  <div
                    className="rounded-lg border bg-muted/50 px-3 py-2 text-sm"
                    key={attachment.oss_id}
                  >
                    {attachment.file_name}
                  </div>
                );
              })}
            </div>
          )}

          {/* 消息内容 */}
          <div
            className={cn("rounded-2xl px-3 py-2", {
              "bg-[#006cff] text-white text-right": isUser,
              "bg-transparent px-0 py-0": !isUser,
            })}
          >
            {isUser ? (
              message.content
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Response>{message.content}</Response>
                {isStreaming && message.is_streaming && (
                  <span className="inline-block animate-pulse">▊</span>
                )}
              </div>
            )}
          </div>

          {/* 已提交表单（只读） */}
          {isUser && message.formData?.type === "pre_questions" && (
            <PreQuestionsSubmitted
              answers={message.formData.answers as Record<string, string>}
              questions={message.formData.questions as PreQuestion[]}
              selectedTypeLabel={
                (message.formData.selectedTypeLabel as string) || ""
              }
            />
          )}
          {isUser && message.formData?.type === "fill_questions" && (
            <FillQuestionsSubmitted
              questions={message.formData.questions as FillQuestion[]}
              values={message.formData.values as Record<string, string>}
            />
          )}
          {isUser && message.formData?.type === "supplement_info" && (
            <SupplementSubmitted
              fields={message.formData.fields as SupplementField[]}
              values={message.formData.values as Record<string, string>}
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
      className="group/message fade-in w-full animate-in duration-300"
      data-role="assistant"
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <div className="animate-pulse">
            <SparklesIcon size={14} />
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="flex items-center gap-1 p-0 text-muted-foreground text-sm">
            <span className="animate-pulse">思考中</span>
            <span className="inline-flex">
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 消息操作栏（consulting 阶段 "生成文书" 按钮）
// ============================================================
function MessageActionBar({
  onGenerateDocument,
  isLoading,
}: {
  onGenerateDocument: () => void;
  isLoading?: boolean;
}) {
  return (
    <div className="flex gap-2 pl-10">
      <Button
        disabled={isLoading}
        onClick={onGenerateDocument}
        size="sm"
        variant="outline"
      >
        生成文书
      </Button>
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
  documentTypes: import("@/lib/legal/types").DocumentTypeOption[];
  templateId: string | null;
  completedDocument?: {
    document_id: string;
    doc_type: string;
    content: string;
    download_url: string;
  };
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
            content={completedDocument.content}
            docType={completedDocument.doc_type}
            downloadUrl={completedDocument.download_url}
            isLoading={isLoading}
            onClose={onClose}
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
    embedSessionToken,
    // 各阶段专属状态
    canSkipContract,
    supplementFields,
    preQuestions,
    fillQuestions,
    documentTypes,
    templateId,
    completedDocument,
    streamingEnabled,
    // 方法
    sendMessage,
    skipContractCheck,
    submitFillQuestions,
    submitSupplementInfo,
    generateDocument,
    submitPreQuestions,
    closeSession,
    stopStream,
    reset,
    initSession,
    setStreamingEnabled,
  } = useLegalChat({ enableStreaming: true });

  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState<LegalAttachment[]>([]);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitializedRef = useRef(false);

  // 初始化会话（使用 ref 防止 React Strict Mode 下重复调用）
  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;
    initSession();
  }, [initSession]);

  // 监听新建会话事件
  useEffect(() => {
    const handleNewSession = () => {
      // 重置状态并初始化新会话
      reset();
      hasInitializedRef.current = false;
      // 下一个 tick 初始化新会话
      setTimeout(() => {
        hasInitializedRef.current = true;
        initSession();
      }, 0);
    };

    window.addEventListener("legal-new-session", handleNewSession);
    return () => {
      window.removeEventListener("legal-new-session", handleNewSession);
    };
  }, [reset, initSession]);

  // 滚动到底部
  // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖 messages 和 currentStep 作为触发条件
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStep]);

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
        headers,
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
    [embedSessionToken]
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

  // 语音录制完成后处理（只填充文本，不添加附件）
  const handleVoiceRecordingComplete = useCallback(
    async (blob: Blob, _duration: number) => {
      try {
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
          headers,
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
    [embedSessionToken]
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

  // 显示输入区域的条件
  const showInput = currentStep === "greeting" || currentStep === "consulting";

  // 是否显示交互组件
  const showStepInteraction = currentStep !== "greeting";

  return (
    <div className="flex h-full flex-col">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4">
          {/* 空状态 */}
          {messages.length === 0 && !isLoading && <LegalGreeting />}

          {/* 消息列表 */}
          <div className="space-y-4">
            {messages.map((message) => (
              <LegalMessageItem
                isStreaming={isStreaming}
                key={message.id}
                message={message}
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

            {/* 消息操作栏：consulting 阶段可生成文书时显示 */}
            {currentStep === "consulting" && (
              <MessageActionBar
                isLoading={isLoading}
                onGenerateDocument={generateDocument}
              />
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
                onReset={reset}
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

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域 */}
      {showInput && (
        <div className="border-t bg-background p-4">
          <div className="mx-auto max-w-3xl">
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
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <div className="group relative" key={attachment.oss_id}>
                    <PreviewAttachment
                      attachment={{
                        url: attachment.local_url || attachment.file_url || "",
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

            {/* 输入区域：录音模式 vs 普通模式 */}
            {isRecordingMode ? (
              <InlineVoiceRecorder
                disabled={isLoading || isStreaming}
                isRecording={isVoiceRecording}
                onCancel={cancelVoiceRecording}
                onConfirm={confirmVoiceRecording}
              />
            ) : (
              <div className="relative flex items-end gap-2">
                <Textarea
                  className="min-h-[80px] resize-none pr-12"
                  disabled={isLoading || isStreaming}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="请描述您的法律问题..."
                  ref={textareaRef}
                  rows={3}
                  value={inputValue}
                />

                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  {/* 附件上传按钮 */}
                  <Button
                    className="size-8"
                    disabled={isLoading || isStreaming}
                    onClick={() => fileInputRef.current?.click()}
                    size="icon"
                    title="上传附件"
                    variant="ghost"
                  >
                    <PaperclipIcon className="size-4" />
                  </Button>

                  {/* 语音输入按钮 */}
                  <Button
                    className="size-8"
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
                        "size-4",
                        voicePermission === false && "opacity-50"
                      )}
                    />
                  </Button>

                  {isStreaming ? (
                    <Button
                      className="size-8"
                      onClick={stopStream}
                      size="icon"
                      variant="ghost"
                    >
                      <StopIcon size={16} />
                    </Button>
                  ) : (
                    <Button
                      className="size-8"
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
              </div>
            )}

            {/* 重置按钮和流式开关 */}
            <div className="mt-2 flex items-center justify-between">
              <button
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
                  streamingEnabled
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                )}
                onClick={() => setStreamingEnabled(!streamingEnabled)}
                type="button"
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    streamingEnabled ? "bg-blue-500" : "bg-zinc-400"
                  )}
                />
                {streamingEnabled ? "流式响应" : "普通响应"}
              </button>

              {messages.length > 0 && (
                <Button onClick={reset} size="sm" variant="ghost">
                  重新开始
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
            <Button onClick={reset} variant="outline">
              开始新的咨询
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
