"use client";

import { useCallback, useRef, useState } from "react";

import { readSSEStreamWithAbort } from "@/lib/legal/stream-parser";
import type {
  DocumentPath,
  FactAnalysis,
  LegalApiResponse,
  LegalAttachment,
  LegalChatState,
  LegalInteractRequest,
  LegalMessage,
  LegalResponseData,
  LegalStep,
  PathInfo,
  QuestionMeta,
  QuestionProgress,
  RecommendedPath,
  StreamEvent,
  SupplementField,
} from "@/lib/legal/types";
import { generateUUID } from "@/lib/utils";

// Hook 配置选项
export interface UseLegalChatOptions {
  /** 是否启用流式响应，默认 true */
  enableStreaming?: boolean;
}

// 初始状态
const initialState: LegalChatState = {
  sessionId: null,
  currentStep: "greeting",
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,

  // embed 会话
  embedSessionToken: null,
  limits: null,

  // greeting
  greeting: undefined,

  // consulting
  consultationProgress: null,
  needMoreInfo: false,
  canProceed: false,

  // select_document_path
  caseInfo: undefined,
  documentPaths: [],
  recommendedPath: null,
  selectedPath: null,

  // ask_question
  currentQuestion: null,
  questionProgress: null,
  requireAttachment: false,
  attachmentHint: null,
  factAnalysis: null,
  pathInfo: null,

  // check_labor_contract
  canSkipContract: false,

  // supplement_info
  supplementFields: [],

  // completed
  completedDocument: undefined,
};

/**
 * 根据 next_step 提取消息内容
 * 不同阶段的主要内容字段不同
 */
function extractMessageContent(
  step: LegalStep,
  data: LegalResponseData
): string {
  switch (step) {
    case "greeting":
      return data.message || "欢迎使用法律文书助手";

    case "consulting":
      return data.message || "";

    case "select_document_path":
      return data.legal_analysis || data.message || "";

    case "path_selected":
      return data.message || "已确认选择";

    case "ask_question": {
      // question 可能是字符串或 QuestionMeta 对象
      if (typeof data.question === "string") {
        return data.question;
      }
      if (data.question && typeof data.question === "object") {
        return data.question.question || "";
      }
      return data.message || "";
    }

    case "check_labor_contract":
      return data.message || "请确认您是否有劳动合同";

    case "supplement_info":
      return data.message || "请补充以下信息";

    case "completed":
      return data.content || data.message || "文书已生成完成";

    default:
      return data.message || "";
  }
}

/**
 * 根据 next_step 处理状态更新
 * 每个阶段有独立的状态处理逻辑
 */
function processStepData(
  step: LegalStep,
  data: LegalResponseData,
  prevState: LegalChatState
): Partial<LegalChatState> {
  const baseUpdate: Partial<LegalChatState> = {
    currentStep: step,
  };

  switch (step) {
    case "greeting":
      return {
        ...baseUpdate,
        greeting: {
          message: data.message || "",
          prompt: data.prompt || "请描述您的问题或案件情况：",
        },
      };

    case "consulting":
      return {
        ...baseUpdate,
        consultationProgress: data.consultation_progress || {
          consultation_count: data.consultation_count || 1,
          max_consultations: data.max_consultations || 2,
        },
        needMoreInfo: data.need_more_info ?? true,
        canProceed: data.can_proceed ?? false,
      };

    case "select_document_path":
      return {
        ...baseUpdate,
        caseInfo:
          data.case_type && data.confidence !== undefined
            ? {
                case_type: data.case_type,
                confidence: data.confidence,
              }
            : prevState.caseInfo,
        documentPaths: data.document_paths || prevState.documentPaths,
        recommendedPath:
          (data.recommended_path as RecommendedPath) ||
          prevState.recommendedPath,
      };

    case "path_selected":
      return {
        ...baseUpdate,
        // auto_continue 标记需要在组件层处理自动触发下一步
      };

    case "ask_question": {
      // 处理 question 字段，可能是字符串或对象
      let questionMeta: QuestionMeta | null = null;
      let progress: QuestionProgress | null = null;

      if (typeof data.question === "object" && data.question !== null) {
        questionMeta = data.question as QuestionMeta;
        progress = questionMeta.progress || data.progress || null;
      } else if (typeof data.question === "string") {
        questionMeta = {
          question_id: data.question_id || generateUUID(),
          question: data.question,
          progress: data.progress || { current: 0, total: 0 },
        };
        progress = data.progress || null;
      }

      return {
        ...baseUpdate,
        currentQuestion: questionMeta,
        questionProgress: progress,
        requireAttachment: data.require_attachment ?? false,
        attachmentHint: data.attachment_hint || null,
        factAnalysis: (data.fact_analysis as FactAnalysis) || null,
        pathInfo: (data.path_info as PathInfo) || null,
      };
    }

    case "check_labor_contract":
      return {
        ...baseUpdate,
        canSkipContract: data.can_skip ?? true,
      };

    case "supplement_info":
      return {
        ...baseUpdate,
        supplementFields: (data.fields as SupplementField[]) || [],
      };

    case "completed":
      return {
        ...baseUpdate,
        completedDocument: {
          document_id: data.document_id || "",
          doc_type: data.doc_type || "",
          content: data.content || data.document_content || "",
          download_url: data.download_url || "",
        },
      };

    default:
      return baseUpdate;
  }
}

export function useLegalChat(options: UseLegalChatOptions = {}) {
  const { enableStreaming = true } = options;

  const [state, setState] = useState<LegalChatState>(initialState);
  const [streamingEnabled, setStreamingEnabled] = useState(enableStreaming);
  const abortControllerRef = useRef<AbortController | null>(null);

  const postInteract = useCallback(
    (body: LegalInteractRequest, signal: AbortSignal) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (state.embedSessionToken) {
        headers["x-embed-session-token"] = state.embedSessionToken;
      }
      return fetch("/api/legal/interact", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });
    },
    [state.embedSessionToken]
  );

  const postCancel = useCallback(
    async (sessionId: string) => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (state.embedSessionToken) {
          headers["x-embed-session-token"] = state.embedSessionToken;
        }
        await fetch("/api/legal/cancel", {
          method: "POST",
          headers,
          body: JSON.stringify({ sessionUuid: sessionId }),
        });
      } catch {
        // best-effort
      }
    },
    [state.embedSessionToken]
  );

  // 添加用户消息
  const addUserMessage = useCallback(
    (content: string, attachments?: LegalAttachment[]) => {
      const message: LegalMessage = {
        id: generateUUID(),
        role: "user",
        content,
        attachments,
        created_at: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, message],
      }));

      return message;
    },
    []
  );

  // 添加助手消息
  const addAssistantMessage = useCallback(
    (
      content: string,
      step?: LegalStep,
      data?: LegalResponseData,
      isStreaming = false
    ) => {
      const message: LegalMessage = {
        id: generateUUID(),
        role: "assistant",
        content,
        step,
        data,
        is_streaming: isStreaming,
        created_at: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, message],
      }));

      return message;
    },
    []
  );

  // 更新最后一条助手消息
  const updateLastAssistantMessage = useCallback(
    (updates: Partial<LegalMessage>) => {
      setState((prev) => {
        const messages = [...prev.messages];
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "assistant") {
            messages[i] = { ...messages[i], ...updates };
            break;
          }
        }
        return { ...prev, messages };
      });
    },
    []
  );

  /**
   * 统一的响应处理函数
   * 根据 next_step 分发到对应的处理逻辑
   */
  const handleResponse = useCallback(
    (response: LegalApiResponse) => {
      const { session_id, next_step, data } = response;

      // 提取消息内容
      const messageContent = extractMessageContent(next_step, data);

      // 处理状态更新
      setState((prev) => {
        const stepUpdates = processStepData(next_step, data, prev);
        return {
          ...prev,
          sessionId: session_id || prev.sessionId,
          isLoading: false,
          ...stepUpdates,
        };
      });

      // 添加助手消息
      addAssistantMessage(messageContent, next_step, data);

      // 返回响应数据，供调用方判断是否需要自动继续
      return { next_step, data };
    },
    [addAssistantMessage]
  );

  // 发送消息
  const sendMessage = useCallback(
    async (message: string, attachments?: LegalAttachment[]) => {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const signal = controller.signal;

      // 添加用户消息
      const trimmedMessage = message.trim();
      const hasAttachments = Boolean(attachments && attachments.length > 0);
      if (trimmedMessage || hasAttachments) {
        addUserMessage(trimmedMessage || "【附件】", attachments);
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const requestBody: LegalInteractRequest = {
          session_id: state.sessionId || undefined,
          message: trimmedMessage || undefined,
          action: "continue",
          media_attachments: attachments?.map((a) => ({
            oss_id: a.oss_id,
            file_name: a.file_name,
            file_size: a.file_size,
            content_type: a.content_type,
          })),
          stream: streamingEnabled,
        };

        const response = await postInteract(requestBody, signal);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Request failed");
        }

        const contentType = response.headers.get("content-type");

        // 处理 SSE 流
        if (contentType?.includes("text/event-stream")) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isStreaming: true,
          }));

          // 先创建占位消息，避免 fallback/异常时无消息可更新
          addAssistantMessage("", state.currentStep, undefined, true);

          let streamingContent = "";
          let finalStep: LegalStep | undefined;
          let finalData: LegalResponseData | undefined;
          let doneReceived = false;
          let fallbackRequested = false;
          let fallbackMessage: string | undefined;

          await readSSEStreamWithAbort(
            response,
            (event: StreamEvent) => {
              switch (event.type) {
                case "start":
                  setState((prev) => ({
                    ...prev,
                    sessionId: event.session_id || prev.sessionId,
                  }));
                  if (event.next_step) {
                    updateLastAssistantMessage({ step: event.next_step });
                  }
                  break;

                case "content":
                  streamingContent += event.content || "";
                  updateLastAssistantMessage({
                    content: streamingContent,
                  });
                  break;

                case "done":
                  doneReceived = true;
                  finalStep = event.next_step;
                  finalData = event.data;

                  // 使用统一的状态处理
                  setState((prev) => {
                    const stepUpdates = processStepData(
                      event.next_step || prev.currentStep,
                      event.data || {},
                      prev
                    );
                    return {
                      ...prev,
                      sessionId: event.session_id || prev.sessionId,
                      isStreaming: false,
                      ...stepUpdates,
                    };
                  });

                  // 更新消息内容
                  updateLastAssistantMessage({
                    content:
                      streamingContent ||
                      extractMessageContent(
                        event.next_step || "greeting",
                        event.data || {}
                      ),
                    step: event.next_step,
                    data: event.data,
                    is_streaming: false,
                  });
                  break;

                case "error":
                  setState((prev) => ({
                    ...prev,
                    isStreaming: false,
                    error: event.message || "Stream error",
                  }));
                  updateLastAssistantMessage({ is_streaming: false });
                  break;

                case "fallback":
                  fallbackRequested = true;
                  fallbackMessage = event.message || "此阶段使用非流式响应";
                  setState((prev) => ({
                    ...prev,
                    isStreaming: false,
                    isLoading: true,
                  }));
                  updateLastAssistantMessage({
                    content: fallbackMessage,
                    is_streaming: false,
                  });
                  controller.abort();
                  break;
                default:
                  break;
              }
            },
            signal
          );

          if (signal.aborted && !fallbackRequested) {
            return;
          }

          // fallback：自动无感切换到 non-stream
          if (fallbackRequested) {
            const retryController = new AbortController();
            abortControllerRef.current = retryController;

            const retryBody: LegalInteractRequest = {
              ...requestBody,
              stream: false,
            };

            const retryResponse = await postInteract(
              retryBody,
              retryController.signal
            );
            if (!retryResponse.ok) {
              const errorData = await retryResponse.json().catch(() => ({}));
              throw new Error((errorData as any).error || "Request failed");
            }
            const data: LegalApiResponse = await retryResponse.json();

            const { session_id, next_step, data: respData } = data;
            const content = extractMessageContent(next_step, respData);

            setState((prev) => {
              const stepUpdates = processStepData(next_step, respData, prev);
              return {
                ...prev,
                sessionId: session_id || prev.sessionId,
                isLoading: false,
                isStreaming: false,
                ...stepUpdates,
              };
            });

            updateLastAssistantMessage({
              content,
              step: next_step,
              data: respData,
              is_streaming: false,
            });

            return { next_step, data: respData };
          }

          if (!doneReceived) {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              error: prev.error || "Stream ended unexpectedly",
            }));
            updateLastAssistantMessage({ is_streaming: false });
          }

          return { next_step: finalStep, data: finalData };
        }

        // 处理非流式响应
        const data: LegalApiResponse = await response.json();
        return handleResponse(data);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isStreaming: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      }
    },
    [
      state.sessionId,
      state.currentStep,
      streamingEnabled,
      addUserMessage,
      addAssistantMessage,
      updateLastAssistantMessage,
      handleResponse,
      postInteract,
    ]
  );

  // 选择文档路径
  const selectPath = useCallback(
    async (path: DocumentPath) => {
      // 兼容 name 和 path_name 两种字段名
      const pathName = path.name || path.path_name || "";

      setState((prev) => ({
        ...prev,
        selectedPath: path,
        isLoading: true,
        error: null,
      }));

      // 添加用户选择消息
      addUserMessage(pathName);

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await postInteract(
          {
            session_id: state.sessionId || undefined,
            message: pathName,
            action: "continue",
            stream: false,
          },
          controller.signal
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error((errorData as any).error || "Request failed");
        }
        const data: LegalApiResponse = await response.json();
        return handleResponse(data);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Request failed",
        }));
      }
    },
    [state.sessionId, handleResponse, addUserMessage, postInteract]
  );

  // 自动继续（用于 path_selected 等需要自动触发下一步的场景）
  const autoContinue = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await postInteract(
        {
          session_id: state.sessionId || undefined,
          action: "continue",
          stream: false,
        },
        controller.signal
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any).error || "Request failed");
      }
      const data: LegalApiResponse = await response.json();
      return handleResponse(data);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Request failed",
      }));
    }
  }, [state.sessionId, handleResponse, postInteract]);

  // 跳过劳动合同检查
  const skipContractCheck = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    addUserMessage("【跳过】");

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await postInteract(
        {
          session_id: state.sessionId || undefined,
          action: "skip",
          stream: false,
        },
        controller.signal
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any).error || "Request failed");
      }
      const data: LegalApiResponse = await response.json();
      return handleResponse(data);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Request failed",
      }));
    }
  }, [state.sessionId, handleResponse, addUserMessage, postInteract]);

  // 提交补充信息
  const submitSupplementInfo = useCallback(
    async (fieldValues: Record<string, string>) => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      addUserMessage("【提交信息】");

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await postInteract(
          {
            session_id: state.sessionId || undefined,
            action: "submit_answers",
            data: fieldValues,
            stream: false,
          },
          controller.signal
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error((errorData as any).error || "Request failed");
        }
        const data: LegalApiResponse = await response.json();
        return handleResponse(data);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Request failed",
        }));
      }
    },
    [state.sessionId, handleResponse, addUserMessage, postInteract]
  );

  // 停止流
  const stopStream = useCallback(() => {
    const sessionId = state.sessionId;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isStreaming: false,
    }));

    updateLastAssistantMessage({
      is_streaming: false,
    });

    if (sessionId) {
      postCancel(sessionId);
    }
  }, [state.sessionId, updateLastAssistantMessage, postCancel]);

  // 重置会话
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState(initialState);
  }, []);

  // 初始化会话（调用 bootstrap 获取 embed session token）
  const initSession = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch("/api/legal/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captchaToken: "mock-pass",
          clientNonce: `nonce-${Date.now()}-${generateUUID().slice(0, 8)}`,
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
          parentReferrer:
            typeof document !== "undefined" ? document.referrer : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error ||
            "Failed to initialize session"
        );
      }

      const data = (await response.json()) as {
        sessionUuid: string;
        embedSessionToken: string;
        expiresIn: number;
        idleExpiresIn: number;
        nextStep: string;
        message: string;
        prompt: string;
        limits: {
          maxRounds: number;
          maxInputChars: number;
          uploadLimitPerMinute: number;
          voiceLimitPerMinute: number;
        };
      };

      setState((prev) => ({
        ...prev,
        sessionId: data.sessionUuid,
        embedSessionToken: data.embedSessionToken,
        limits: data.limits,
        currentStep: "greeting" as const,
        isLoading: false,
        greeting: {
          message: data.message || "",
          prompt: data.prompt || "请描述您的问题或案件情况：",
        },
      }));

      addAssistantMessage(
        data.message || "欢迎使用法律文书助手",
        "greeting",
        {
          message: data.message,
          prompt: data.prompt,
        }
      );
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize session",
      }));
    }
  }, [addAssistantMessage]);

  return {
    // 状态
    ...state,
    streamingEnabled,

    // 方法
    sendMessage,
    selectPath,
    autoContinue,
    skipContractCheck,
    submitSupplementInfo,
    stopStream,
    reset,
    initSession,
    setStreamingEnabled,
  };
}
