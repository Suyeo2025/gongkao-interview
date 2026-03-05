import { randomUUID } from "crypto";
import WebSocket from "ws";

export const runtime = "nodejs";

const WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";

/**
 * POST /api/asr
 * Receives full PCM audio (base64), sends to DashScope via WebSocket,
 * waits for transcription result, returns transcript.
 */
export async function POST(req: Request) {
  const apiKey = req.headers.get("X-Api-Key");
  if (!apiKey) {
    return Response.json({ error: "缺少 API Key" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "无效的请求体" }, { status: 400 });
  }

  const { audio } = body;
  if (!audio) {
    return Response.json({ error: "缺少音频数据" }, { status: 400 });
  }

  const pcmBuffer = Buffer.from(audio, "base64");
  if (pcmBuffer.length === 0) {
    return Response.json({ transcript: "", words: [] });
  }

  const taskId = randomUUID();

  try {
    const result = await transcribeAudio(pcmBuffer, taskId, apiKey);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "转写失败";
    return Response.json({ error: message }, { status: 502 });
  }
}

function transcribeAudio(
  pcmBuffer: Buffer,
  taskId: string,
  apiKey: string
): Promise<{ transcript: string; words: Array<{ text: string; beginTime: number; endTime: number }> }> {
  return new Promise((resolve, reject) => {
    let transcript = "";
    let words: Array<{ text: string; beginTime: number; endTime: number }> = [];
    let settled = false;

    const done = (result: typeof words extends never ? never : { transcript: string; words: typeof words }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { ws.close(); } catch { /* ignore */ }
      resolve(result);
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { ws.close(); } catch { /* ignore */ }
      reject(err);
    };

    const timeout = setTimeout(() => {
      fail(new Error("转写超时（60s）"));
    }, 60000);

    const ws = new WebSocket(WS_URL, {
      headers: { Authorization: `bearer ${apiKey}` },
    });

    ws.on("error", (err) => {
      fail(new Error(`WebSocket 错误: ${err.message}`));
    });

    ws.on("open", () => {
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
          // Send all audio in chunks
          const CHUNK_SIZE = 32768;
          for (let i = 0; i < pcmBuffer.length; i += CHUNK_SIZE) {
            ws.send(pcmBuffer.subarray(i, i + CHUNK_SIZE));
          }
          // Signal end of audio
          ws.send(JSON.stringify({
            header: {
              action: "finish-task",
              task_id: taskId,
              streaming: "duplex",
            },
            payload: { input: {} },
          }));
        } else if (event === "result-generated") {
          const sentence = msg.payload?.output?.sentence;
          if (sentence && sentence.sentence_end) {
            transcript += sentence.text || "";
            if (Array.isArray(sentence.words)) {
              words.push(
                ...sentence.words.map((w: { text: string; begin_time: number; end_time: number }) => ({
                  text: w.text,
                  beginTime: w.begin_time,
                  endTime: w.end_time,
                }))
              );
            }
          }
        } else if (event === "task-finished") {
          done({ transcript, words });
        } else if (event === "task-failed") {
          fail(new Error(msg.header?.error_message || "ASR 识别失败"));
        }
      } catch { /* ignore parse errors */ }
    });

    ws.on("close", () => {
      fail(new Error("连接意外关闭"));
    });
  });
}
