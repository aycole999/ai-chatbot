"use client";

/**
 * 法律文书助手 - 各阶段专属渲染组件 (Legal Elite V2.0)
 */

import { useRef, useState } from "react";
import { PlusIcon } from "@/components/icons";
import type {
  DocumentTypeOption,
  FillQuestion,
  PreQuestion,
  SupplementField,
} from "@/lib/legal/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

// ============================================================
// 文书类型自动推荐策略
// ============================================================
function inferDocumentType(answers: Record<string, string>): string {
  const q1 = answers.q1 || "";
  const q2 = answers.q2 || "";
  const q3 = answers.q3 || "";
  const q4 = answers.q4 || "";

  if (q1 === "yes" && q2 === "secondary" && q4 === "unstable") {
    return "payment_order";
  }
  if (q1 === "no" && q3 === "urgent") {
    return "reconciliation_letter";
  }
  if (q1 === "yes" && q2 === "secondary" && q4 === "stable") {
    return "complaint_letter";
  }
  if (q2 === "priority") {
    return "labor_arbitration";
  }
  return "labor_arbitration";
}

// ============================================================
// 劳动合同检查 (check_labor_contract 阶段)
// ============================================================
interface LaborContractCheckProps {
  message: string;
  canSkip?: boolean;
  isLoading?: boolean;
  onConfirm: (hasContract: boolean) => void;
  onSkip?: () => void;
}

export function LaborContractCheck({
  message,
  canSkip,
  isLoading,
  onConfirm,
  onSkip,
}: LaborContractCheckProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 font-semibold text-primary">
        <div className="size-2 rounded-full bg-primary animate-pulse" />
        {message}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          className="h-12 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
          disabled={isLoading}
          onClick={() => onConfirm(true)}
          variant="default"
        >
          我有劳动合同
        </Button>
        <Button
          className="h-12 rounded-xl border-primary/20 hover:bg-primary/5 transition-all active:scale-95"
          disabled={isLoading}
          onClick={() => onConfirm(false)}
          variant="outline"
        >
          我没有劳动合同
        </Button>
      </div>
      {canSkip && onSkip && (
        <Button 
          className="w-full text-muted-foreground hover:text-primary transition-colors" 
          disabled={isLoading} 
          onClick={onSkip} 
          variant="ghost"
        >
          暂不确定，先跳过
        </Button>
      )}
    </div>
  );
}

// ============================================================
// 填充问题表单 (fill_questions / supplement_info 阶段)
// ============================================================
interface FillQuestionsFormProps {
  questions: FillQuestion[];
  isLoading?: boolean;
  onSubmit: (questions: FillQuestion[], values: Record<string, string>) => void;
}

export function FillQuestionsForm({
  questions,
  isLoading,
  onSubmit,
}: FillQuestionsFormProps, ref: any) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleChange = (questionId: string, value: string) => {
    setValues((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(questions, values);
  };

  const isValid = questions
    .filter((q) => q.required)
    .every((q) => values[q.question_id]?.trim());

  return (
    <form className="space-y-6 rounded-2xl border border-border/50 bg-background p-6 shadow-xl animate-in fade-in zoom-in-95 duration-500" onSubmit={handleSubmit}>
      <div className="space-y-1 border-b pb-4">
        <h3 className="font-bold text-lg tracking-tight text-foreground">完善细节信息</h3>
        <p className="text-sm text-muted-foreground">请填写以下信息以便我们生成更精准的文书</p>
      </div>

      <div className="space-y-5">
        {questions.map((q) => (
          <div className="space-y-2" key={q.question_id}>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 px-1" htmlFor={q.question_id}>
              {q.question}
              {q.required && <span className="ml-1 text-destructive">*</span>}
            </label>
            <Input
              className="h-12 rounded-xl bg-muted/30 border-none px-4 focus-visible:ring-primary/20 focus-visible:bg-background transition-all shadow-inner"
              disabled={isLoading}
              id={q.question_id}
              onChange={(e) => handleChange(q.question_id, e.target.value)}
              placeholder={q.placeholder || "请输入详细信息..."}
              required={q.required}
              value={values[q.question_id] || ""}
            />
          </div>
        ))}
      </div>

      <Button className="h-12 w-full rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all" disabled={isLoading || !isValid} type="submit">
        {isLoading ? "正在生成..." : "提交并预览文书"}
      </Button>
    </form>
  );
}

// ============================================================
// 补充信息表单 (supplement_info 阶段 - SupplementField 格式)
// ============================================================
interface SupplementFormProps {
  fields: SupplementField[];
  isLoading?: boolean;
  onSubmit: (fields: SupplementField[], values: Record<string, string>) => void;
}

export function SupplementForm({
  fields,
  isLoading,
  onSubmit,
}: SupplementFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleChange = (fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(fields, values);
  };

  const isValid = fields
    .filter((f) => f.required)
    .every((f) => values[f.field_id]?.trim());

  return (
    <form className="space-y-6 rounded-2xl border border-border/50 bg-background p-6 shadow-xl animate-in fade-in zoom-in-95 duration-500" onSubmit={handleSubmit}>
      <div className="space-y-1 border-b pb-4">
        <h3 className="font-bold text-lg tracking-tight text-foreground">补充必要材料</h3>
        <p className="text-sm text-muted-foreground">最后一步，我们需要补充以下细节</p>
      </div>

      <div className="space-y-5">
        {fields.map((field) => (
          <div className="space-y-2" key={field.field_id}>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 px-1" htmlFor={field.field_id}>
              {field.label}
              {field.required && <span className="ml-1 text-destructive">*</span>}
            </label>

            {field.type === "textarea" ? (
              <Textarea
                className="rounded-xl bg-muted/30 border-none px-4 py-3 focus-visible:ring-primary/20 focus-visible:bg-background transition-all shadow-inner min-h-[100px]"
                disabled={isLoading}
                id={field.field_id}
                onChange={(e) => handleChange(field.field_id, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
                value={values[field.field_id] || ""}
              />
            ) : field.type === "select" && field.options ? (
              <select
                className="flex h-12 w-full rounded-xl border-none bg-muted/30 px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:bg-background transition-all shadow-inner disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                id={field.field_id}
                onChange={(e) => handleChange(field.field_id, e.target.value)}
                required={field.required}
                value={values[field.field_id] || ""}
              >
                <option value="">{field.placeholder || "请选择..."}</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                className="h-12 rounded-xl bg-muted/30 border-none px-4 focus-visible:ring-primary/20 focus-visible:bg-background transition-all shadow-inner"
                disabled={isLoading}
                id={field.field_id}
                onChange={(e) => handleChange(field.field_id, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
                type={field.type === "date" ? "date" : "text"}
                value={values[field.field_id] || ""}
              />
            )}
          </div>
        ))}
      </div>

      <Button className="h-12 w-full rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all" disabled={isLoading || !isValid} type="submit">
        {isLoading ? "提交中..." : "确认并生成文书"}
      </Button>
    </form>
  );
}

import { DocumentPreview } from "./legal-refined-ui";
import { toast } from "sonner";

// ============================================================
// 完成状态 (completed 阶段)
// ============================================================
interface CompletedDocumentProps {
  docType: string;
  content: string;
  downloadUrl?: string;
  isLoading?: boolean;
  onDownload: () => void | Promise<void>;
  onReset: () => void;
  onClose?: () => void;
}

export function CompletedDocument({
  docType,
  content,
  downloadUrl,
  isLoading,
  onDownload,
  onReset,
  onClose,
}: CompletedDocumentProps) {
  const paperRef = useRef<HTMLDivElement | null>(null);

  const getPrintableText = () => {
    const renderedContent = paperRef.current
      ?.querySelector<HTMLElement>("[data-document-preview-copy-source]")
      ?.innerText?.trim();

    return renderedContent || content.trim();
  };

  const handleCopy = async () => {
    const trimmedContent = getPrintableText();
    if (!trimmedContent) {
      toast.error("当前没有可复制的文书内容");
      return;
    }

    try {
      await navigator.clipboard.writeText(trimmedContent);
      toast.success("文书内容已复制到剪贴板");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = trimmedContent;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        const copied = document.execCommand("copy");
        if (copied) {
          toast.success("文书内容已复制到剪贴板");
          return;
        }
      } catch {
        // no-op, unified failure handling below
      } finally {
        document.body.removeChild(textarea);
      }

      toast.error("复制失败，请检查浏览器剪贴板权限");
    }
  };

  const handlePrint = () => {
    const paper = paperRef.current;
    if (!paper || !getPrintableText()) {
      toast.error("当前没有可打印的文书内容");
      return;
    }

    const printWindow = window.open("", "_blank", "width=960,height=1200");
    if (!printWindow) {
      toast.error("打印窗口被浏览器拦截，请允许弹窗后重试");
      return;
    }

    const styles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((node) => node.outerHTML)
      .join("\n");

    printWindow.document.write(`
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${docType || "法律文书"}</title>
          ${styles}
          <style>
            @page {
              size: A4;
              margin: 14mm 12mm;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }

            body {
              color: #18181b;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .document-print-shell {
              padding: 0;
            }

            [data-document-preview-paper] {
              max-width: none !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
            }
          </style>
        </head>
        <body>
          <div class="document-print-shell">${paper.outerHTML}</div>
        </body>
      </html>
    `);
    printWindow.document.close();

    let hasTriggeredPrint = false;

    const triggerPrint = () => {
      if (hasTriggeredPrint || printWindow.closed) {
        return;
      }
      hasTriggeredPrint = true;

      const performPrint = () => {
        if (printWindow.closed) {
          return;
        }
        printWindow.focus();
        printWindow.print();
      };

      const fontsReady = printWindow.document.fonts?.ready;
      if (fontsReady) {
        fontsReady
          .catch(() => undefined)
          .finally(() => {
            window.setTimeout(performPrint, 150);
          });
        return;
      }

      window.setTimeout(performPrint, 150);
    };

    const closePrintWindow = () => {
      if (!printWindow.closed) {
        printWindow.close();
      }
    };

    printWindow.addEventListener("afterprint", closePrintWindow, {
      once: true,
    });

    printWindow.addEventListener("beforeunload", () => {
      hasTriggeredPrint = true;
    });

    printWindow.onload = () => {
      window.setTimeout(triggerPrint, 80);
    };

    window.setTimeout(() => {
      printWindow.focus();
      triggerPrint();
    }, 400);
  };

  const handleDownload = () => {
    if (!downloadUrl) {
      toast.error("当前没有可下载的文书文件");
      return;
    }

    Promise.resolve(onDownload()).catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <DocumentPreview
        title={docType}
        content={content}
        onCopy={handleCopy}
        onPrint={handlePrint}
        onDownload={handleDownload}
        onEdit={() => toast.info("在线编辑功能即将上线")}
        paperRef={paperRef}
      />

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Button
            className="h-12 rounded-xl border-dashed"
            onClick={onReset}
            variant="outline"
          >
            重新生成
          </Button>
          {onClose && (
            <Button
              className="h-12 rounded-xl"
              disabled={isLoading}
              onClick={onClose}
              variant="secondary"
            >
              完成并退出
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 问卷表单 (pre_questions 阶段)
// ============================================================
interface PreQuestionsFormProps {
  questions: PreQuestion[];
  documentTypes: DocumentTypeOption[];
  templateId: string;
  isLoading?: boolean;
  onSubmit: (
    templateId: string,
    answers: Record<string, string>,
    questions: PreQuestion[],
    selectedType: string,
    selectedTypeLabel: string
  ) => void;
}

export function PreQuestionsForm({
  questions,
  documentTypes,
  templateId,
  isLoading,
  onSubmit,
}: PreQuestionsFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedDocType, setSelectedDocType] = useState<string>("");

  const handleAnswer = (questionId: string, value: string) => {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    const inferred = inferDocumentType(next);
    if (documentTypes.some((dt) => dt.value === inferred)) {
      setSelectedDocType(inferred);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDocType) {
      const dtLabel =
        documentTypes.find((dt) => dt.value === selectedDocType)?.label || "";
      onSubmit(templateId, answers, questions, selectedDocType, dtLabel);
    }
  };

  const requiredAnswered = questions
    .filter((q) => q.required)
    .every((q) => answers[q.question_id]);
  const isValid = requiredAnswered && selectedDocType !== "";
  const inferredType = inferDocumentType(answers);

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div className="space-y-4">
        {questions.map((q) => (
          <div
            className="group space-y-3 rounded-2xl border border-border/50 bg-background/50 p-5 transition-all hover:border-primary/20 hover:shadow-md"
            key={q.question_id}
          >
            <div className="font-bold text-sm tracking-tight px-1 text-foreground">
              {q.question}
              {q.required && <span className="ml-1 text-destructive">*</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <button
                  className={cn(
                    "relative overflow-hidden rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                    answers[q.question_id] === opt.value
                      ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                      : "bg-background hover:border-primary/50 hover:bg-primary/5"
                  )}
                  disabled={isLoading}
                  key={opt.value}
                  onClick={() => handleAnswer(q.question_id, opt.value)}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {documentTypes.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center justify-between px-1 text-foreground">
            <div className="font-bold text-sm">为您推荐的文书方案</div>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Smart AI Selection</span>
          </div>
          <div className="grid gap-3">
            {documentTypes.map((dt) => (
              <button
                className={cn(
                  "group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all",
                  selectedDocType === dt.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-inner"
                    : "bg-background hover:border-primary/30 hover:shadow-sm"
                )}
                disabled={isLoading}
                key={dt.value}
                onClick={() => setSelectedDocType(dt.value)}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex size-8 items-center justify-center rounded-lg transition-colors",
                      selectedDocType === dt.value ? "bg-primary text-primary-foreground" : "bg-muted group-hover:bg-primary/10 group-hover:text-primary"
                    )}>
                      <PlusIcon className="size-4" />
                    </div>
                    <span className="font-bold text-sm tracking-tight text-foreground">{dt.label}</span>
                  </div>
                  {inferredType === dt.value && requiredAnswered && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-primary text-[10px] font-black uppercase tracking-tighter">
                      AI RECOMENDED
                    </span>
                  )}
                </div>
                <div className="mt-2 text-muted-foreground text-xs pl-11 leading-relaxed opacity-80">
                  {dt.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <Button className="h-14 w-full rounded-2xl bg-primary text-lg font-bold shadow-xl shadow-primary/20 active:scale-[0.98] transition-all" disabled={isLoading || !isValid} type="submit">
        {isLoading ? "正在处理流程..." : "开始生成正式文书"}
      </Button>
    </form>
  );
}

// ============================================================
// 已提交问卷（只读，pre_questions 阶段）
// ============================================================
interface PreQuestionsSubmittedProps {
  questions: PreQuestion[];
  answers: Record<string, string>;
  selectedTypeLabel: string;
}

export function PreQuestionsSubmitted({
  questions,
  answers,
  selectedTypeLabel,
}: PreQuestionsSubmittedProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm">
      {questions.map((q) => {
        const selected = answers[q.question_id];
        const label =
          q.options.find((o) => o.value === selected)?.label || selected || "—";
        return (
          <div key={q.question_id}>
            <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest">{q.question}</div>
            <div className="font-semibold text-[15px] leading-7 text-foreground">{label}</div>
          </div>
        );
      })}
      <div className="border-t border-border/50 pt-3">
        <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest">最终文书类型</div>
        <div className="font-bold text-[15px] leading-7 text-primary">{selectedTypeLabel}</div>
      </div>
    </div>
  );
}

// ============================================================
// 已提交填充问题（只读，fill_questions 阶段）
// ============================================================
interface FillQuestionsSubmittedProps {
  questions: FillQuestion[];
  values: Record<string, string>;
}

export function FillQuestionsSubmitted({
  questions,
  values,
}: FillQuestionsSubmittedProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm">
      {questions.map((q) => (
        <div key={q.question_id}>
          <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest">{q.question}</div>
          <div className="font-semibold text-[15px] leading-7 text-foreground">
            {values[q.question_id] || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 已提交补充信息（只读，supplement_info 阶段）
// ============================================================
interface SupplementSubmittedProps {
  fields: SupplementField[];
  values: Record<string, string>;
}

export function SupplementSubmitted({
  fields,
  values,
}: SupplementSubmittedProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm">
      {fields.map((f) => (
        <div key={f.field_id}>
          <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest">{f.label}</div>
          <div className="font-semibold text-[15px] leading-7 text-foreground">{values[f.field_id] || "—"}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 会话结束提示 (session_closed 阶段)
// ============================================================
interface SessionClosedBannerProps {
  message?: string;
  onReset: () => void;
}

export function SessionClosedBanner({
  message,
  onReset,
}: SessionClosedBannerProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-border/50 bg-muted/10 p-8 text-center animate-in fade-in zoom-in-95">
      <div className="flex flex-col items-center gap-2">
        <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
           <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
           </svg>
        </div>
        <div className="text-muted-foreground font-medium">
          {message || "咨询流程已闭环，感谢您的信任！"}
        </div>
      </div>
      <Button className="rounded-xl px-8" onClick={onReset} variant="outline">
        发起新咨询
      </Button>
    </div>
  );
}
