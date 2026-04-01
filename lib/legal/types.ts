/**
 * 法律文档聊天类型定义
 * Legal document chat type definitions
 */

// 会话步骤类型
export type LegalStep =
  | "greeting"
  | "consulting"
  | "select_document_path"
  | "path_selected"
  | "ask_question"
  | "check_labor_contract"
  | "supplement_info"
  | "completed";

// 文档路径定义（后端返回 id/name，兼容 path_id/path_name）
export interface DocumentPath {
  id?: string;
  path_id?: string;
  name?: string;
  path_name?: string;
  description: string;
  is_recommended?: boolean;
}

// 问题进度
export interface QuestionProgress {
  current: number;
  total: number;
}

// 问题元数据
export interface QuestionMeta {
  question_id: string;
  question: string;
  progress: QuestionProgress;
  fact_analysis?: string;
  attachment_hint?: string;
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

// 咨询进度
export interface ConsultationProgress {
  consultation_count: number;
  max_consultations: number;
}

// 路径信息（问答阶段）
export interface PathInfo {
  path_id: number;
  description: string;
  switched_path: boolean;
}

// 事实分析结果
export interface FactAnalysis {
  summary: string;
  extracted_facts: string[];
  legal_basis: string[];
}

// 推荐路径
export interface RecommendedPath {
  id: string;
  name: string;
  reason: string;
}

// 后端响应数据
export interface LegalResponseData {
  // 通用字段
  message?: string;
  prompt?: string;

  // greeting 阶段
  // - message, prompt

  // consulting 阶段
  need_more_info?: boolean;
  can_proceed?: boolean;
  consultation_count?: number;
  max_consultations?: number;
  consultation_progress?: ConsultationProgress;
  attachment_analysis?: AttachmentAnalysis[];

  // select_document_path 阶段
  case_type?: string;
  confidence?: number;
  legal_analysis?: string;
  document_paths?: DocumentPath[];
  recommended_path?: RecommendedPath;

  // path_selected 阶段
  auto_continue?: boolean;

  // ask_question 阶段
  question_id?: string;
  question?: string | QuestionMeta;
  current_element?: string;
  progress?: QuestionProgress;
  require_attachment?: boolean;
  attachment_hint?: string;
  path_info?: PathInfo;
  fact_analysis?: FactAnalysis;

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
  oss_id: number;
  file_name?: string;
  file_size?: number;
  content_type?: string;
  media_duration?: number;
}

// UI 附件信息（用于预览/发送）
export interface LegalAttachment {
  oss_id: number;
  file_url?: string; // 上传后返回的 URL
  local_url?: string; // 本地预览 URL（Object URL）
  file_name: string;
  content_type: string;
  file_size?: number;
}

// 消息角色
export type LegalMessageRole = "user" | "assistant" | "system";

// 消息类型
export interface LegalMessage {
  id: string;
  role: LegalMessageRole;
  content: string;
  step?: LegalStep;
  data?: LegalResponseData;
  attachments?: LegalAttachment[];
  is_streaming?: boolean;
  created_at: Date;
}

// API 请求体
export interface LegalInteractRequest {
  session_id?: string;
  message?: string;
  stream?: boolean;
  action?:
    | "continue"
    | "skip"
    | "submit_answers"
    | "submit_pre_questions"
    | "pre_generate_document"
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
  consultationProgress: ConsultationProgress | null;
  needMoreInfo: boolean;
  canProceed: boolean;

  // select_document_path 阶段
  caseInfo?: {
    case_type: string;
    confidence: number;
  };
  documentPaths: DocumentPath[];
  recommendedPath: RecommendedPath | null;
  selectedPath: DocumentPath | null;

  // ask_question 阶段
  currentQuestion: QuestionMeta | null;
  questionProgress: QuestionProgress | null;
  requireAttachment: boolean;
  attachmentHint: string | null;
  factAnalysis: FactAnalysis | null;
  pathInfo: PathInfo | null;

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
