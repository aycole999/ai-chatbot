"use client";

import { useCallback, useRef, useState } from "react";

import { readSSEStreamWithAbort } from "@/lib/legal/stream-parser";
import type {
  FillQuestion,
  LegalApiResponse,
  LegalAttachment,
  LegalChatState,
  LegalFormMessageData,
  LegalInteractRequest,
  LegalMessage,
  LegalResponseData,
  LegalStep,
  PreQuestion,
  StreamEvent,
  SupplementField,
} from "@/lib/legal/types";
import { generateUUID } from "@/lib/utils";

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
  canGenerateDocument: false,
  collectedFacts: null,

  // fill_questions
  fillQuestions: [],

  // pre_questions
  preQuestions: [],
  documentTypes: [],
  templateId: null,

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

    case "fill_questions":
      return data.message || "请补充以下信息";

    case "check_labor_contract":
      return data.message || "请确认您是否有劳动合同";

    case "supplement_info":
      return data.message || "请补充以下信息";

    case "pre_questions":
      return data.message || "请填写以下信息以生成文书";

    case "check_info":
    case "generate_document":
      return data.message || "";

    case "completed":
      return data.content || data.message || "文书已生成完成";

    case "session_closed":
      return data.message || "会话已结束，感谢您的使用！";

    default:
      return data.message || "";
  }
}

function isUserInteractionStep(step: LegalStep): boolean {
  return (
    step === "greeting" ||
    step === "consulting" ||
    step === "fill_questions" ||
    step === "check_labor_contract" ||
    step === "supplement_info" ||
    step === "pre_questions" ||
    step === "completed" ||
    step === "session_closed"
  );
}

/**
 * 根据后端 next_step 直接构造下一次请求。
 * 前端只判断该阶段是否需要停下来等待用户输入，不再本地维护 step->action 映射。
 */
function resolveAutomaticStageRequest(
  step: LegalStep
): Pick<LegalInteractRequest, "action" | "stream"> | null {
  if (isUserInteractionStep(step)) {
    return null;
  }

  return {
    action: step,
    stream: step === "generate_document",
  };
}

function hasVisibleAssistantMessage(content: string): boolean {
  return content.trim().length > 0;
}

function normalizeDocumentTitle(value?: string): string {
  return value
    ?.replace(/^#+\s*/g, "")
    .replace(/^\*+\s*/g, "")
    .replace(/\*+$/g, "")
    .trim() || "";
}

function normalizeCompletedDownloadUrl(
  downloadUrl?: string,
  documentId?: string
): string {
  if (downloadUrl?.startsWith("/document/download/")) {
    return downloadUrl.replace(
      "/document/download/",
      "/api/document/download/"
    );
  }

  if (downloadUrl?.trim()) {
    return downloadUrl;
  }

  if (documentId) {
    return `/api/document/download/${encodeURIComponent(documentId)}`;
  }

  return "";
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
        canGenerateDocument: Boolean(data.data?.can_generate_document),
        collectedFacts: data.data?.collected_facts ?? null,
      };

    case "fill_questions": {
      // 后端返回多种格式：
      // 1. data.fill_questions — FillQuestion[]
      // 2. data.questions — 通用 questions 数组
      // 3. data.data.missing_info — 上游格式 {field, label, required}[]
      let fillQs: FillQuestion[] = [];

      if (data.fill_questions && data.fill_questions.length > 0) {
        fillQs = data.fill_questions;
      } else if (data.data?.missing_info && data.data.missing_info.length > 0) {
        fillQs = data.data.missing_info.map((item) => ({
          question_id: item.field,
          element: item.field,
          question: item.label,
          placeholder: `请输入${item.label}`,
          required: item.required ?? true,
        }));
      } else if (data.questions) {
        fillQs = data.questions as unknown as FillQuestion[];
      }

      return {
        ...baseUpdate,
        fillQuestions: fillQs,
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
        // supplement_info 可能用 fields 或 questions
        supplementFields: (data.fields as SupplementField[]) || [],
        fillQuestions:
          (data.fill_questions as FillQuestion[]) ||
          (data.questions as unknown as FillQuestion[]) ||
          prevState.fillQuestions,
      };

    case "pre_questions":
      return {
        ...baseUpdate,
        preQuestions: (data.questions as PreQuestion[]) || [],
        // 后端返回 id，前端用 value，做归一化
        documentTypes: (
          (data.document_types || []) as unknown as Record<string, string>[]
        ).map((dt) => ({
          value: dt.value || dt.id || "",
          label: dt.label || "",
          description: dt.description || "",
        })),
        templateId: data.template_id || null,
      };

    case "completed":
      return {
        ...baseUpdate,
        completedDocument: {
          document_id: data.document_id || "",
          doc_type:
            normalizeDocumentTitle(data.data?.document?.name) ||
            normalizeDocumentTitle(data.doc_type) ||
            "",
          content:
            data.data?.document?.content ||
            data.content ||
            data.document_content ||
            "",
          download_url: normalizeCompletedDownloadUrl(
            data.download_url,
            data.document_id
          ),
        },
      };

    case "session_closed":
      return baseUpdate;

    default:
      return baseUpdate;
  }
}

export function useLegalChat() {
  const [state, setState] = useState<LegalChatState>(initialState);
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
        type: "text",
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

  const addUserFormMessage = useCallback((formData: LegalFormMessageData) => {
    const message: LegalMessage = {
      id: generateUUID(),
      role: "user",
      type: "form_submission",
      content: "",
      formData,
      created_at: new Date(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));

    return message;
  }, []);

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
        type: "text",
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
      if (hasVisibleAssistantMessage(messageContent)) {
        addAssistantMessage(messageContent, next_step, data);
      }

      // 返回响应数据，供调用方判断是否需要自动继续
      return { next_step, data };
    },
    [addAssistantMessage]
  );

  // 针对中间阶段执行下一次明确 action，而不是盲目发送 continue
  const runStageAction = useCallback(
    async (sessionId: string, step: LegalStep) => {
      const nextRequest = resolveAutomaticStageRequest(step);
      if (!nextRequest) {
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const requestBody: LegalInteractRequest = {
          session_id: sessionId,
          ...nextRequest,
        };

        const response = await postInteract(requestBody, controller.signal);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error((errorData as any).error || "Request failed");
        }

        const contentType = response.headers.get("content-type");

        if (contentType?.includes("text/event-stream")) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isStreaming: true,
          }));

          addAssistantMessage("", step, undefined, true);

          let streamingContent = "";
          let finalStep: LegalStep | undefined;
          let finalData: LegalResponseData | undefined;
          let latestSessionId = sessionId;
          let doneReceived = false;
          let fallbackRequested = false;
          let fallbackMessage: string | undefined;

          await readSSEStreamWithAbort(
            response,
            (event: StreamEvent) => {
              switch (event.type) {
                case "start":
                  if (event.session_id) {
                    latestSessionId = event.session_id;
                  }
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

                case "done": {
                  doneReceived = true;
                  finalStep = event.next_step;
                  finalData = event.data;
                  if (event.session_id) {
                    latestSessionId = event.session_id;
                  }

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

                  const fallbackContent = extractMessageContent(
                    event.next_step || "greeting",
                    event.data || {}
                  );

                  updateLastAssistantMessage({
                    content: streamingContent || fallbackContent,
                    step: event.next_step,
                    data: event.data,
                    is_streaming: false,
                  });
                  break;
                }

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
            controller.signal
          );

          if (controller.signal.aborted && !fallbackRequested) {
            return;
          }

          if (fallbackRequested) {
            const retryController = new AbortController();
            abortControllerRef.current = retryController;

            const retryResponse = await postInteract(
              {
                ...requestBody,
                stream: false,
              },
              retryController.signal
            );
            if (!retryResponse.ok) {
              const errorData = await retryResponse.json().catch(() => ({}));
              throw new Error((errorData as any).error || "Request failed");
            }

            const retryData: LegalApiResponse = await retryResponse.json();
            const { session_id, next_step, data: respData } = retryData;
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
              ...(hasVisibleAssistantMessage(content) ? { content } : {}),
              step: next_step,
              data: respData,
              is_streaming: false,
            });

            const result = { next_step, data: respData };
            const upcoming = result
              ? resolveAutomaticStageRequest(result.next_step)
              : null;
            if (upcoming) {
              return runStageAction(
                retryData.session_id || latestSessionId,
                result!.next_step
              );
            }
            return result;
          }

          if (!doneReceived) {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              error: prev.error || "Stream ended unexpectedly",
            }));
            updateLastAssistantMessage({ is_streaming: false });
          }

          const upcoming = finalStep
            ? resolveAutomaticStageRequest(finalStep)
            : null;
          if (finalStep && upcoming) {
            return runStageAction(latestSessionId, finalStep);
          }

          return { next_step: finalStep, data: finalData };
        }

        const data: LegalApiResponse = await response.json();
        const result = handleResponse(data);
        const upcoming = result
          ? resolveAutomaticStageRequest(result.next_step)
          : null;
        if (result && upcoming) {
          return runStageAction(data.session_id || sessionId, result.next_step);
        }
        return result;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Request failed",
        }));
      }
    },
    [addAssistantMessage, handleResponse, postInteract, updateLastAssistantMessage]
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
          stream: true,
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
          let latestSessionId = state.sessionId || "";
          let doneReceived = false;
          let fallbackRequested = false;
          let fallbackMessage: string | undefined;

          await readSSEStreamWithAbort(
            response,
            (event: StreamEvent) => {
              switch (event.type) {
                case "start":
                  if (event.session_id) {
                    latestSessionId = event.session_id;
                  }
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
                  if (event.session_id) {
                    latestSessionId = event.session_id;
                  }

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

            // 自动续发
            const upcoming = resolveAutomaticStageRequest(next_step);
            if (upcoming) {
              return runStageAction(data.session_id || state.sessionId || "", next_step);
            }
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

          // 自动续发
          const upcoming = finalStep
            ? resolveAutomaticStageRequest(finalStep)
            : null;
          if (finalStep && upcoming) {
            return runStageAction(latestSessionId, finalStep);
          }

          return { next_step: finalStep, data: finalData };
        }

        // 处理非流式响应
        const data: LegalApiResponse = await response.json();
        const result = handleResponse(data);

        // 自动续发
        const upcoming = result
          ? resolveAutomaticStageRequest(result.next_step)
          : null;
        if (result && upcoming) {
          return runStageAction(data.session_id || state.sessionId || "", result.next_step);
        }

        return result;
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
      addUserMessage,
      addAssistantMessage,
      updateLastAssistantMessage,
      handleResponse,
      runStageAction,
      postInteract,
    ]
  );

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
      const result = handleResponse(data);
      const upcoming = result
        ? resolveAutomaticStageRequest(result.next_step)
        : null;
      if (result && upcoming) {
        return runStageAction(data.session_id || state.sessionId || "", result.next_step);
      }
      return result;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Request failed",
      }));
    }
  }, [
    state.sessionId,
    handleResponse,
    runStageAction,
    addUserMessage,
    postInteract,
  ]);

  // 提交补充信息（supplement_info 阶段）
  const submitSupplementInfo = useCallback(
    async (fields: SupplementField[], fieldValues: Record<string, string>) => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      addUserFormMessage({
        type: "supplement_info",
        fields,
        values: fieldValues,
      });

      // 构建 answers 数组格式
      const answers = fields.map((f) => ({
        question_id: f.field_id,
        element: f.label,
        answer: fieldValues[f.field_id] || "",
      }));

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await postInteract(
          {
            session_id: state.sessionId || undefined,
            action: "submit_answers",
            data: { answers },
            stream: false,
          },
          controller.signal
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error((errorData as any).error || "Request failed");
        }
        const data: LegalApiResponse = await response.json();
        const result = handleResponse(data);
        const upcoming = result
          ? resolveAutomaticStageRequest(result.next_step)
          : null;
        if (result && upcoming) {
          return runStageAction(
            data.session_id || state.sessionId || "",
            result.next_step
          );
        }
        return result;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Request failed",
        }));
      }
    },
    [
      state.sessionId,
      handleResponse,
      runStageAction,
      addUserFormMessage,
      postInteract,
    ]
  );

  // 触发生成文书（从 consulting 进入 pre_questions）
  const generateDocument = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    addUserMessage("【生成文书】");

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await postInteract(
        {
          session_id: state.sessionId || undefined,
          action: "pre_generate_document",
          stream: false,
        },
        controller.signal
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any).error || "Request failed");
      }
      const data: LegalApiResponse = await response.json();
      const result = handleResponse(data);
      const upcoming = result
        ? resolveAutomaticStageRequest(result.next_step)
        : null;
      if (result && upcoming) {
        return runStageAction(data.session_id || state.sessionId || "", result.next_step);
      }
      return result;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Request failed",
      }));
    }
  }, [
    state.sessionId,
    handleResponse,
    runStageAction,
    addUserMessage,
    postInteract,
  ]);

  // 提交填充问题（fill_questions 阶段）
  const submitFillQuestions = useCallback(
    async (questions: FillQuestion[], values: Record<string, string>) => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      addUserFormMessage({
        type: "fill_questions",
        questions,
        values,
      });

      // 构建后端期望的 answers 数组
      const answers = questions.map((q) => ({
        question_id: q.question_id,
        element: q.element || "",
        answer: values[q.question_id] || "",
      }));

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await postInteract(
          {
            session_id: state.sessionId || undefined,
            action: "submit_answers",
            data: { answers },
            stream: false,
          },
          controller.signal
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error((errorData as any).error || "Request failed");
        }
        const data: LegalApiResponse = await response.json();
        const result = handleResponse(data);
        const upcoming = result
          ? resolveAutomaticStageRequest(result.next_step)
          : null;
        if (result && upcoming) {
          return runStageAction(
            data.session_id || state.sessionId || "",
            result.next_step
          );
        }
        return result;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Request failed",
        }));
      }
    },
    [
      state.sessionId,
      handleResponse,
      runStageAction,
      addUserFormMessage,
      postInteract,
    ]
  );

  // 提交问卷答案（pre_questions 阶段，非流式）
  const submitPreQuestions = useCallback(
    async (
      templateId: string,
      answers: Record<string, string>,
      questions: PreQuestion[],
      selectedType: string,
      selectedTypeLabel: string
    ) => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      addUserFormMessage({
        type: "pre_questions",
        questions,
        answers,
        selectedType,
        selectedTypeLabel,
      });

      // 构建后端期望的 answers 数组（带 answer_label）
      const answersArray = Object.entries(answers).map(([qid, val]) => ({
        question_id: qid,
        element: "",
        answer: val,
        answer_label:
          questions
            .find((q) => q.question_id === qid)
            ?.options.find((o) => o.value === val)?.label || "",
      }));

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await postInteract(
          {
            session_id: state.sessionId || undefined,
            action: "submit_pre_questions",
            data: {
              answers: answersArray,
              template_id: String(templateId),
              selected_type: selectedType,
              selected_type_label: selectedTypeLabel,
            },
            stream: false,
          },
          controller.signal
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error((errorData as any).error || "Request failed");
        }
        const data: LegalApiResponse = await response.json();
        const result = handleResponse(data);
        const upcoming = result
          ? resolveAutomaticStageRequest(result.next_step)
          : null;
        if (result && upcoming) {
          return runStageAction(
            data.session_id || state.sessionId || "",
            result.next_step
          );
        }
        return result;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Request failed",
        }));
      }
    },
    [
      state.sessionId,
      handleResponse,
      runStageAction,
      addUserFormMessage,
      postInteract,
    ]
  );

  // 关闭会话
  const closeSession = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    addUserMessage("【结束会话】");

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await postInteract(
        {
          session_id: state.sessionId || undefined,
          action: "close",
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
          pageUrl: typeof window === "undefined" ? "" : window.location.href,
          parentReferrer:
            typeof document === "undefined" ? undefined : document.referrer,
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

      addAssistantMessage(data.message || "欢迎使用法律文书助手", "greeting", {
        message: data.message,
        prompt: data.prompt,
      });
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
  };
}
