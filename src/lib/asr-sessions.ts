import WebSocket from "ws";

const WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";

// 空闲超时：最后一次收到音频后 5 分钟无活动才清理（考虑思考时间）
const SESSION_IDLE_MS = 5 * 60 * 1000;

export interface ASRSession {
  ws: WebSocket;
  taskId: string;
  push: (event: string, data: unknown) => void;
  close: () => void;
  idleTimer: ReturnType<typeof setTimeout>;
}

// Module-level store — shared across route handlers in the same process
const sessions = new Map<string, ASRSession>();

export function getSession(id: string) {
  return sessions.get(id);
}

export function deleteSession(id: string) {
  const s = sessions.get(id);
  if (s) {
    clearTimeout(s.idleTimer);
    try { s.ws.close(); } catch { /* ignore */ }
    sessions.delete(id);
  }
}

/** 每次收到音频时调用，重置空闲计时器 */
export function touchSession(id: string) {
  const s = sessions.get(id);
  if (!s) return;
  clearTimeout(s.idleTimer);
  s.idleTimer = setTimeout(() => {
    console.warn("[ASR] session %s idle timeout (%ds no audio)", id, SESSION_IDLE_MS / 1000);
    s.push("error", { message: "长时间无音频输入，会话已关闭" });
    s.close();
    deleteSession(id);
  }, SESSION_IDLE_MS);
}

export function createSession(
  sessionId: string,
  taskId: string,
  apiKey: string,
  push: (event: string, data: unknown) => void,
  close: () => void,
): ASRSession {
  const ws = new WebSocket(WS_URL, {
    headers: { Authorization: `bearer ${apiKey}` },
  });

  const idleTimer = setTimeout(() => {
    console.warn("[ASR] session %s idle timeout (%ds no audio)", sessionId, SESSION_IDLE_MS / 1000);
    push("error", { message: "长时间无音频输入，会话已关闭" });
    close();
    deleteSession(sessionId);
  }, SESSION_IDLE_MS);

  const session: ASRSession = { ws, taskId, push, close, idleTimer };
  sessions.set(sessionId, session);

  ws.on("open", () => {
    console.log("[ASR] ws open, session=%s", sessionId);
    ws.send(JSON.stringify({
      header: {
        action: "run-task",
        task_id: taskId,
        streaming: "duplex",
      },
      payload: {
        task_group: "audio",
        task: "asr",
        function: "recognition",
        model: "paraformer-realtime-v2",
        parameters: {
          format: "pcm",
          sample_rate: 16000,
          language_hints: ["zh", "en"],
        },
        input: {},
      },
    }));
  });

  ws.on("message", (data: WebSocket.Data, isBinary: boolean) => {
    if (isBinary) return;
    try {
      const msg = JSON.parse(data.toString());
      const event = msg.header?.event;

      if (event === "task-started") {
        push("started", {});
      } else if (event === "result-generated") {
        const sentence = msg.payload?.output?.sentence;
        if (sentence) {
          push("result", {
            text: sentence.text || "",
            isFinal: !!sentence.sentence_end,
            words: Array.isArray(sentence.words)
              ? sentence.words.map((w: { text: string; begin_time: number; end_time: number; punctuation?: string }) => ({
                  text: w.text,
                  beginTime: w.begin_time,
                  endTime: w.end_time,
                  punctuation: w.punctuation,
                }))
              : [],
          });
        }
      } else if (event === "task-finished") {
        push("finished", {});
        close();
        deleteSession(sessionId);
      } else if (event === "task-failed") {
        const errMsg = msg.header?.error_message || "ASR 识别失败";
        console.error("[ASR] task-failed:", JSON.stringify(msg.header));
        push("error", { message: errMsg });
        close();
        deleteSession(sessionId);
      }
    } catch { /* ignore */ }
  });

  ws.on("error", (err) => {
    console.error("[ASR] ws error:", err.message);
    push("error", { message: `WebSocket 错误: ${err.message}` });
    close();
    deleteSession(sessionId);
  });

  ws.on("close", () => {
    if (sessions.has(sessionId)) {
      push("error", { message: "连接意外关闭" });
      close();
      deleteSession(sessionId);
    }
  });

  return session;
}
