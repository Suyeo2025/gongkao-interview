import WebSocket from "ws";
import { randomUUID } from "crypto";
import {
  getServerCachedAudio,
  setServerCachedAudio,
} from "@/lib/server-audio-cache";

export const runtime = "nodejs";

const WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";
const MAX_TEXT_LENGTH = 2000; // CosyVoice practical limit

export interface WordTimestamp {
  text: string;
  beginTime: number; // ms
  endTime: number;   // ms
}

interface TTSResult {
  audio: string;         // base64
  timestamps: WordTimestamp[];
}

function extractWords(
  obj: Record<string, unknown> | undefined,
  seen: Set<string>,
  out: WordTimestamp[],
) {
  if (!obj) return;

  // Collect candidates from both possible fields
  const candidates: Array<{ text: string; begin_time: number; end_time: number }> = [];

  // payload.output.sentence.words (singular — incremental)
  const sentence = obj.sentence as Record<string, unknown> | undefined;
  if (sentence && Array.isArray(sentence.words)) {
    candidates.push(...sentence.words);
  }
  // payload.output.sentences[].words (plural — may be cumulative)
  const sentences = obj.sentences as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(sentences)) {
    for (const s of sentences) {
      if (Array.isArray(s.words)) {
        candidates.push(...s.words);
      }
    }
  }

  // Deduplicate by (beginTime, endTime) to prevent the same word being added multiple times
  for (const w of candidates) {
    const key = `${w.begin_time}:${w.end_time}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ text: w.text, beginTime: w.begin_time, endTime: w.end_time });
    }
  }
}

export async function POST(req: Request) {
  try {
    const { text, apiKey, model, voice, customTargetModel, instruct } = await req.json();

    if (!apiKey) {
      return Response.json({ error: "请先配置 DashScope API Key" }, { status: 400 });
    }
    if (!text?.trim()) {
      return Response.json({ error: "缺少朗读文本" }, { status: 400 });
    }

    // Truncate text to prevent API failures
    const cleanText = text.trim().slice(0, MAX_TEXT_LENGTH);
    const useVoice = voice || "longanxuan_v3";
    // For custom voices, use the target model they were enrolled with
    const useModel = customTargetModel || model || "cosyvoice-v3-flash";

    // Check server-side disk cache first
    const cached = getServerCachedAudio(cleanText, useVoice, useModel);
    if (cached) {
      console.log("[TTS] cache hit, timestamps=%d", cached.timestamps.length);
      return Response.json({ audio: cached.audioBase64, timestamps: cached.timestamps });
    }

    const taskId = randomUUID();
    const audioChunks: Buffer[] = [];
    const timestamps: WordTimestamp[] = [];
    const seenWords = new Set<string>();

    const result = await new Promise<TTSResult>((resolve, reject) => {
      const ws = new WebSocket(WS_URL, {
        headers: { Authorization: `bearer ${apiKey}` },
      });

      let resolved = false;
      const done = (err?: Error) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        try { ws.close(); } catch { /* ignore */ }
        if (err) return reject(err);
        const audioBuffer = Buffer.concat(audioChunks);
        // Sort by time to ensure chronological order
        timestamps.sort((a, b) => a.beginTime - b.beginTime || a.endTime - b.endTime);
        resolve({ audio: audioBuffer.toString("base64"), timestamps });
      };

      // Custom voices may need longer for first synthesis
      const timeoutMs = 120_000;
      const timer = setTimeout(() => done(new Error(`TTS 请求超时 (${timeoutMs / 1000}s)`)), timeoutMs);

      ws.on("open", () => {
        console.log("[TTS] ws open, model=%s, voice=%s, textLen=%d", useModel, useVoice, cleanText.length);
        ws.send(JSON.stringify({
          header: {
            action: "run-task",
            task_id: taskId,
            streaming: "duplex",
          },
          payload: {
            task_group: "audio",
            task: "tts",
            function: "SpeechSynthesizer",
            model: useModel,
            parameters: {
              text_type: "PlainText",
              voice: useVoice,
              format: "mp3",
              sample_rate: 22050,
              volume: 50,
              rate: 1,
              pitch: 1,
              word_timestamp_enabled: true,
              ...(instruct ? { instruct } : {}),
            },
            input: {},
          },
        }));
      });

      ws.on("message", (data: WebSocket.Data, isBinary: boolean) => {
        if (isBinary) {
          audioChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
          return;
        }

        try {
          const msg = JSON.parse(data.toString());
          const event = msg.header?.event;

          if (event === "task-started") {
            console.log("[TTS] task-started, sending text chunks...");
            // Send text in chunks for reliability
            const chunkSize = 500;
            for (let i = 0; i < cleanText.length; i += chunkSize) {
              ws.send(JSON.stringify({
                header: {
                  action: "continue-task",
                  task_id: taskId,
                  streaming: "duplex",
                },
                payload: {
                  input: { text: cleanText.slice(i, i + chunkSize) },
                },
              }));
            }
            ws.send(JSON.stringify({
              header: {
                action: "finish-task",
                task_id: taskId,
                streaming: "duplex",
              },
              payload: { input: {} },
            }));
          } else if (event === "result-generated") {
            extractWords(msg.payload?.output, seenWords, timestamps);
            if (timestamps.length % 50 === 0) {
              console.log("[TTS] result-generated, timestamps=%d, audioKB=%d", timestamps.length, Math.round(Buffer.concat(audioChunks).length / 1024));
            }
          } else if (event === "task-finished") {
            // NOTE: Do NOT collect timestamps here — task-finished repeats
            // the same words already collected from result-generated events,
            // which would double the array and cause subtitle flickering.
            console.log("[TTS] done, audio=%dKB, timestamps=%d", Math.round(Buffer.concat(audioChunks).length / 1024), timestamps.length);
            done();
          } else if (event === "task-failed") {
            const errMsg = msg.header?.error_message || msg.payload?.output?.message || "TTS 合成失败";
            const errCode = msg.header?.error_code || "";
            console.error("[TTS] task-failed:", JSON.stringify(msg.header));
            done(new Error(`${errMsg} (code: ${errCode}, model: ${useModel}, voice: ${useVoice})`));
          } else {
            console.log("[TTS] event:", event);
          }
        } catch (e) {
          console.error("[TTS] message parse error:", e);
        }
      });

      ws.on("error", (err) => done(new Error(`WebSocket 错误: ${err.message}`)));

      ws.on("close", (code) => {
        if (!resolved && audioChunks.length === 0) {
          done(new Error(`连接异常关闭 (code: ${code})`));
        }
      });
    });

    // Write to server-side disk cache for persistence
    setServerCachedAudio(cleanText, useVoice, useModel, result.audio, result.timestamps);

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS 服务错误";
    console.error("[TTS] error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
