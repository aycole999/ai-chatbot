/**
 * 法律文档聊天类型定义
 * Legal document chat type definitions
 */

// 会话步骤类型
export type LegalStep =
  | "greeting"
  | "consulting"
  | "check_info"
  | "fill_questions"
  | "check_labor_contract"
  | "supplement_info"
  | "pre_questions"
  | "generate_document"
  | "completed"
  | "session_closed";

// 问卷问题（pre_questions 阶段）
export interface PreQuestion {
  question_id: string;
  question: string;
  options: { value: string; label: string }[];
  required: boolean;
}

// 文书类型选项（pre_questions 阶段）
export interface DocumentTypeOption {
  value: string;
  label: string;
  description: string;
}

// 填充问题（fill_questions 阶段，文本输入）
export interface FillQuestion {
  question_id: string;
  element: string;
  question: string;
  placeholder?: string;
  required: boolean;
  suggestions?: string[];
}

// 附件分析结果
export interface AttachmentAnalysis {
  attachment_id: string;
  type: string;
  type_name: string;
  confidence?: number;
  summary?: string;
  is_duplicate?: boolean;
  duplicate_message?: string;
}

// 上游透传的嵌套数据（check_info / fill_questions 等阶段）
export interface UpstreamNestedData {
  missing_info?: Array<{ field: string; label: string; required: boolean }>;
  collected_info?: Record<string, string>;
  collected_facts?: Record<string, string>;
  can_generate_document?: boolean;
  consultation_count?: number;
  multi_case?: Record<string, unknown>;
  document?: {
    type?: string;
    name?: string;
    content?: string;
  };
  download_url?: string;
  completion_rate?: number;
  selected_name?: string;
  selected_type?: string;
}

// 后端响应数据
export interface LegalResponseData {
  // 通用字段
  message?: string;
  prompt?: string;

  // 上游透传嵌套数据和可用操作
  data?: UpstreamNestedData;
  actions?: string[];

  // greeting 阶段
  // - message, prompt

  // consulting 阶段
  // - data.can_generate_document, data.collected_facts
  attachment_analysis?: AttachmentAnalysis[];

  // fill_questions 阶段（后端 fill_questions 和 supplement_info 都用 questions 字段）
  fill_questions?: FillQuestion[];

  // pre_questions 阶段
  questions?: PreQuestion[];
  document_types?: DocumentTypeOption[];
  template_id?: string;

  // check_labor_contract 阶段
  can_skip?: boolean;

  // supplement_info 阶段
  fields?: SupplementField[];

  // completed 阶段
  document_id?: string;
  doc_type?: string;
  content?: string;
  download_url?: string;
  document_content?: string;
}

// 补充信息字段定义
export interface SupplementField {
  field_id: string;
  label: string;
  type: "text" | "date" | "select" | "textarea";
  required: boolean;
  options?: string[];
  placeholder?: string;
}

// API 响应
export interface LegalApiResponse {
  session_id: string;
  next_step: LegalStep;
  data: LegalResponseData;
}

// SSE 流事件类型
export type StreamEventType =
  | "start"
  | "content"
  | "done"
  | "error"
  | "fallback";

// SSE 流事件
export interface StreamEvent {
  type: StreamEventType;
  session_id?: string;
  next_step?: LegalStep;
  content?: string;
  data?: LegalResponseData;
  message?: string;
}

// ============================================================
// Embed API 类型
// ============================================================

// Bootstrap 请求
export interface BootstrapRequest {
  captchaToken: string;
  clientNonce: string;
  pageUrl: string;
  parentReferrer?: string;
}

// Bootstrap 响应
export interface BootstrapResponse {
  sessionUuid: string;
  embedSessionToken: string;
  expiresIn: number;
  idleExpiresIn: number;
  nextStep: string;
  message: string;
  prompt: string;
  limits: EmbedLimits;
}

// 会话限制
export interface EmbedLimits {
  maxRounds: number;
  maxInputChars: number;
  uploadLimitPerMinute: number;
  voiceLimitPerMinute: number;
}

// 语音识别响应
export interface VoiceRecognizeResponse {
  text: string;
  provider: string;
  elapsedMs: number;
}

// 会话详情
export interface EmbedSessionInfo {
  sessionUuid: string;
  currentStep: string;
  status: number;
  expireTime: string;
  messageCount: number;
  lastMessageText: string;
}

// App 侧媒体附件（通过 ossId 引用；后端负责 textract 与落库）
export interface LegalMediaAttachment {
  oss_id: string;
  file_name?: string;
  file_size?: number;
  content_type?: string;
  media_duration?: number;
}

// UI 附件信息（用于预览/发送）
export interface LegalAttachment {
  oss_id: string;
  file_url?: string; // 上传后返回的 URL
  local_url?: string; // 本地预览 URL（Object URL）
  file_name: string;
  content_type: string;
  file_size?: number;
}

// 消息角色
export type LegalMessageRole = "user" | "assistant" | "system";

export type LegalMessageType = "text" | "form_submission";

export interface LegalPreQuestionsFormData {
  type: "pre_questions";
  questions: PreQuestion[];
  answers: Record<string, string>;
  selectedType: string;
  selectedTypeLabel: string;
}

export interface LegalFillQuestionsFormData {
  type: "fill_questions";
  questions: FillQuestion[];
  values: Record<string, string>;
}

export interface LegalSupplementInfoFormData {
  type: "supplement_info";
  fields: SupplementField[];
  values: Record<string, string>;
}

export type LegalFormMessageData =
  | LegalPreQuestionsFormData
  | LegalFillQuestionsFormData
  | LegalSupplementInfoFormData;

// 消息类型
export interface LegalMessage {
  id: string;
  role: LegalMessageRole;
  type: LegalMessageType;
  content: string;
  step?: LegalStep;
  data?: LegalResponseData;
  attachments?: LegalAttachment[];
  is_streaming?: boolean;
  created_at: Date;
  // 提交表单后的持久化数据（用于只读渲染）
  formData?: LegalFormMessageData;
}

// API 请求体
export interface LegalInteractRequest {
  session_id?: string;
  message?: string;
  stream?: boolean;
  action?:
    | "continue"
    | "check_info"
    | "skip"
    | "submit_answers"
    | "submit_pre_questions"
    | "pre_generate_document"
    | "generate_document"
    | "close"
    | string;
  data?: Record<string, unknown>;
  media_attachments?: LegalMediaAttachment[];
}

// 聊天状态
export interface LegalChatState {
  sessionId: string | null;
  currentStep: LegalStep;
  messages: LegalMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;

  // embed 会话
  embedSessionToken: string | null;
  limits: EmbedLimits | null;

  // greeting 阶段
  greeting?: {
    message: string;
    prompt: string;
  };

  // consulting 阶段
  canGenerateDocument: boolean;
  collectedFacts: Record<string, string> | null;

  // pre_questions 阶段
  preQuestions: PreQuestion[];
  documentTypes: DocumentTypeOption[];
  templateId: string | null;

  // fill_questions 阶段
  fillQuestions: FillQuestion[];

  // check_labor_contract 阶段
  canSkipContract: boolean;

  // supplement_info 阶段
  supplementFields: SupplementField[];

  // completed 阶段
  completedDocument?: {
    document_id: string;
    doc_type: string;
    content: string;
    download_url: string;
  };
}

// 语音录制状态
export interface VoiceRecordingState {
  isRecording: boolean;
  duration: number;
  isCancelled: boolean;
  error: string | null;
}
