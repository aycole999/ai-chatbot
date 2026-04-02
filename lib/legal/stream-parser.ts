/**
 * SSE 流解析器
 * Parses Server-Sent Events from backend API
 */

import type { StreamEvent } from "./types";

/**
 * 解析 SSE 数据行
 * @param line SSE 数据行 (格式: "data: {...}")
 * @returns 解析后的事件对象，解析失败返回 null
 */
export function parseSSELine(line: string): StreamEvent | null {
  // 跳过空行和注释
  if (!line || line.startsWith(":")) {
    return null;
  }

  // 解析 data: 前缀
  if (!line.startsWith("data:")) {
    return null;
  }

  const jsonStr = line.slice(5).trim();
  if (!jsonStr) {
    return null;
  }

  try {
    return JSON.parse(jsonStr) as StreamEvent;
  } catch {
    console.error("Failed to parse SSE data:", jsonStr);
    return null;
  }
}

/**
 * 创建 SSE 流读取器
 * @param response fetch 响应对象
 * @param onEvent 事件回调
 * @param onError 错误回调
 */
export async function readSSEStream(
  response: Response,
  onEvent: (event: StreamEvent) => void,
  onError?: (error: Error) => void
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // 按换行符分割处理
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // 最后一个可能是不完整的行

      for (const line of lines) {
        const event = parseSSELine(line);
        if (event) {
          onEvent(event);
        }
      }
    }

    // 处理剩余的 buffer
    if (buffer) {
      const event = parseSSELine(buffer);
      if (event) {
        onEvent(event);
      }
    }
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error);
    } else {
      throw error;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 创建可中止的 SSE 流读取器
 * @param response fetch 响应对象
 * @param onEvent 事件回调
 * @param signal AbortSignal 用于取消流
 */
export async function readSSEStreamWithAbort(
  response: Response,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let released = false;

  const cancelReader = () => {
    if (released) {
      return;
    }

    try {
      void reader.cancel().catch(() => {
        // reader 可能已在底层关闭；取消失败时忽略即可
      });
    } catch {
      // releaseLock 之后再次 cancel 会抛错；这里按中止处理
    }
  };

  // 监听中止信号
  if (signal) {
    if (signal.aborted) {
      cancelReader();
    } else {
      signal.addEventListener("abort", cancelReader, { once: true });
    }
  }

  try {
    while (true) {
      if (signal?.aborted) {
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const event = parseSSELine(line);
        if (event) {
          onEvent(event);
        }
      }
    }

    // 处理剩余的 buffer
    if (buffer && !signal?.aborted) {
      const event = parseSSELine(buffer);
      if (event) {
        onEvent(event);
      }
    }
  } finally {
    released = true;
    if (signal) {
      signal.removeEventListener("abort", cancelReader);
    }
    try {
      reader.releaseLock();
    } catch {
      // 某些异常路径下 reader 可能已被关闭
    }
  }
}
