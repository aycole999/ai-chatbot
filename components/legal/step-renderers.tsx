"use client";

/**
 * 法律文书助手 - 各阶段专属渲染组件
 * 根据 next_step 提供差异化的 UI 渲染
 */

import { useState } from "react";

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
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="font-medium">{message}</div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={isLoading}
          onClick={() => onConfirm(true)}
          variant="default"
        >
          有劳动合同
        </Button>
        <Button
          disabled={isLoading}
          onClick={() => onConfirm(false)}
          variant="outline"
        >
          没有劳动合同
        </Button>
        {canSkip && onSkip && (
          <Button disabled={isLoading} onClick={onSkip} variant="ghost">
            跳过此步骤
          </Button>
        )}
      </div>
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
}: FillQuestionsFormProps) {
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
    <form className="space-y-4" onSubmit={handleSubmit}>
      {questions.map((q) => (
        <div className="space-y-1.5" key={q.question_id}>
          <label className="font-medium text-sm" htmlFor={q.question_id}>
            {q.question}
            {q.required && <span className="text-red-500"> *</span>}
          </label>
          <Input
            disabled={isLoading}
            id={q.question_id}
            onChange={(e) => handleChange(q.question_id, e.target.value)}
            placeholder={q.placeholder || "请输入"}
            required={q.required}
            value={values[q.question_id] || ""}
          />
        </div>
      ))}

      <Button className="w-full" disabled={isLoading || !isValid} type="submit">
        {isLoading ? "提交中..." : "提交信息"}
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
    <form className="space-y-4" onSubmit={handleSubmit}>
      {fields.map((field) => (
        <div className="space-y-1.5" key={field.field_id}>
          <label className="font-medium text-sm" htmlFor={field.field_id}>
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
          </label>

          {field.type === "textarea" ? (
            <Textarea
              disabled={isLoading}
              id={field.field_id}
              onChange={(e) => handleChange(field.field_id, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              value={values[field.field_id] || ""}
            />
          ) : field.type === "select" && field.options ? (
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

      <Button className="w-full" disabled={isLoading || !isValid} type="submit">
        {isLoading ? "提交中..." : "提交信息"}
      </Button>
    </form>
  );
}

// ============================================================
// 完成状态 (completed 阶段)
// ============================================================
interface CompletedDocumentProps {
  docType: string;
  content: string;
  downloadUrl?: string;
  isLoading?: boolean;
  onReset: () => void;
  onClose?: () => void;
}

export function CompletedDocument({
  docType,
  content,
  downloadUrl,
  isLoading,
  onReset,
  onClose,
}: CompletedDocumentProps) {
  return (
    <div className="space-y-4">
      {/* 文书类型标签 */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700 text-sm dark:bg-green-950/50 dark:text-green-400">
          {docType}
        </span>
        <span className="text-green-600 text-sm">已生成完成</span>
      </div>

      {/* 文书内容预览 */}
      <div className="max-h-96 overflow-y-auto rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <pre className="whitespace-pre-wrap font-sans text-sm">{content}</pre>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {downloadUrl && (
          <Button asChild className="flex-1">
            <a download href={downloadUrl}>
              下载文书
            </a>
          </Button>
        )}
        <Button className="flex-1" onClick={onReset} variant="outline">
          开始新的咨询
        </Button>
        {onClose && (
          <Button
            className="flex-1"
            disabled={isLoading}
            onClick={onClose}
            variant="ghost"
          >
            结束会话
          </Button>
        )}
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
    // 根据答案自动推荐文书类型
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
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* 问题列表 */}
      <div className="space-y-4">
        {questions.map((q) => (
          <div
            className="space-y-2 rounded-lg border bg-muted/30 p-4"
            key={q.question_id}
          >
            <div className="font-medium text-sm">
              {q.question}
              {q.required && <span className="text-red-500"> *</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <button
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-all",
                    answers[q.question_id] === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-primary/50"
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

      {/* 文书类型选择 */}
      {documentTypes.length > 0 && (
        <div className="space-y-3">
          <div className="font-medium text-sm">
            请选择文书类型 <span className="text-red-500">*</span>
          </div>
          <div className="grid gap-3">
            {documentTypes.map((dt) => (
              <button
                className={cn(
                  "relative w-full rounded-lg border p-3 text-left transition-all",
                  selectedDocType === dt.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:border-primary/50"
                )}
                disabled={isLoading}
                key={dt.value}
                onClick={() => setSelectedDocType(dt.value)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{dt.label}</span>
                  {inferredType === dt.value && requiredAnswered && (
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-600 text-xs dark:bg-blue-950/50 dark:text-blue-400">
                      推荐
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-muted-foreground text-xs">
                  {dt.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <Button className="w-full" disabled={isLoading || !isValid} type="submit">
        {isLoading ? "提交中..." : "确认提交"}
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
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      {questions.map((q) => {
        const selected = answers[q.question_id];
        const label =
          q.options.find((o) => o.value === selected)?.label || selected || "—";
        return (
          <div key={q.question_id}>
            <div className="text-muted-foreground text-xs">{q.question}</div>
            <div className="font-medium text-sm">{label}</div>
          </div>
        );
      })}
      <div className="border-t pt-2">
        <div className="text-muted-foreground text-xs">文书类型</div>
        <div className="font-medium text-sm">{selectedTypeLabel}</div>
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
    <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
      {questions.map((q) => (
        <div key={q.question_id}>
          <div className="text-muted-foreground text-xs">{q.question}</div>
          <div className="font-medium text-sm">
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
    <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
      {fields.map((f) => (
        <div key={f.field_id}>
          <div className="text-muted-foreground text-xs">{f.label}</div>
          <div className="font-medium text-sm">{values[f.field_id] || "—"}</div>
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
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-center">
      <div className="text-muted-foreground text-sm">
        {message || "会话已结束，感谢您的使用！"}
      </div>
      <Button onClick={onReset} variant="outline">
        开始新的咨询
      </Button>
    </div>
  );
}
