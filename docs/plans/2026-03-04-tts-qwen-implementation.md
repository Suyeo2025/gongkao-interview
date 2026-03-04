# TTS 朗读 + Qwen 文本生成 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "朗读" (read aloud) button to the "考生作答" answer section using DashScope CosyVoice TTS, and add Qwen text generation support alongside existing Gemini.

**Architecture:** Settings expanded with provider selection (Gemini/Qwen), separate DashScope API key for TTS. TTS via Next.js API route that proxies WebSocket to DashScope CosyVoice, returning mp3 audio. Audio cached in IndexedDB keyed by content hash. Qwen uses OpenAI-compatible SDK pointed at DashScope endpoint.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, `openai` npm (Qwen), `ws` npm (WebSocket for TTS API route), `idb-keyval` (IndexedDB cache), DashScope CosyVoice WebSocket API

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install npm packages**

Run:
```bash
npm install openai ws idb-keyval && npm install -D @types/ws
```

Expected: packages added to package.json, no errors.

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add openai, ws, idb-keyval dependencies for TTS and Qwen support"
```

---

### Task 2: Extend Settings Types

**Files:**
- Modify: `src/lib/types.ts:48-65`

**Step 1: Update Settings interface and defaults**

Replace the current `Settings` interface, `DEFAULT_SETTINGS`, and `AVAILABLE_MODELS` in `src/lib/types.ts` (lines 48-65) with:

```typescript
export type TextProvider = "gemini" | "qwen";

export interface Settings {
  // Text generation
  textProvider: TextProvider;
  geminiApiKey: string;
  qwenApiKey: string;
  modelName: string;
  temperature: number;
  // TTS
  dashscopeApiKey: string;
  ttsModel: string;
  ttsVoice: string;
  ttsRate: number;
}

export const DEFAULT_SETTINGS: Settings = {
  textProvider: "gemini",
  geminiApiKey: "",
  qwenApiKey: "",
  modelName: "gemini-2.5-flash",
  temperature: 0.7,
  dashscopeApiKey: "",
  ttsModel: "cosyvoice-v3.5-flash",
  ttsVoice: "longanyang",
  ttsRate: 1.0,
};

export const AVAILABLE_MODELS = [
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (最强)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (推荐)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (最快)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
];

export const QWEN_MODELS = [
  { value: "qwen-max", label: "Qwen Max (最强)" },
  { value: "qwen-plus", label: "Qwen Plus (推荐)" },
  { value: "qwen-turbo", label: "Qwen Turbo (最快)" },
];

export const TTS_MODELS = [
  { value: "cosyvoice-v3.5-flash", label: "CosyVoice v3.5 Flash (推荐)" },
  { value: "cosyvoice-v3.5-plus", label: "CosyVoice v3.5 Plus (最佳)" },
];

export const TTS_VOICES = [
  { value: "longanyang", label: "阳光男声", desc: "自然阳光" },
  { value: "longxiaochun_v2", label: "温柔女声", desc: "温柔亲切" },
  { value: "longhua", label: "标准男声", desc: "沉稳标准" },
  { value: "longwan", label: "知性女声", desc: "知性优雅" },
  { value: "longjing", label: "播音男声", desc: "字正腔圆" },
  { value: "longshuo", label: "有声书男声", desc: "娓娓道来" },
  { value: "longmiao", label: "有声书女声", desc: "声情并茂" },
];

export const TTS_RATES = [
  { value: 0.75, label: "0.75x" },
  { value: 1.0, label: "1.0x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 2.0, label: "2.0x" },
];
```

**Step 2: Update useSettings reset to preserve all API keys**

Modify `src/hooks/useSettings.ts` line 26-29:

```typescript
  const reset = useCallback(() => {
    const next = {
      ...DEFAULT_SETTINGS,
      geminiApiKey: settings.geminiApiKey,
      qwenApiKey: settings.qwenApiKey,
      dashscopeApiKey: settings.dashscopeApiKey,
    };
    setSettings(next);
    saveSettings(next);
  }, [settings.geminiApiKey, settings.qwenApiKey, settings.dashscopeApiKey]);
```

**Step 3: Update useGenerate to pass provider info**

Modify `src/hooks/useGenerate.ts` lines 32-43 (the fetch body) to pass provider:

```typescript
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            provider: settings.textProvider,
            apiKey: settings.textProvider === "gemini" ? settings.geminiApiKey : settings.qwenApiKey,
            config: {
              modelName: settings.modelName,
              temperature: settings.temperature,
            },
          }),
          signal: controller.signal,
        });
```

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors (or only pre-existing ones).

**Step 5: Commit**

```bash
git add src/lib/types.ts src/hooks/useSettings.ts src/hooks/useGenerate.ts
git commit -m "feat: extend Settings with TTS config and Qwen provider support"
```

---

### Task 3: Add Qwen Support to Generate API Route

**Files:**
- Modify: `src/app/api/generate/route.ts`

**Step 1: Rewrite generate route to support both providers**

Replace the entire file `src/app/api/generate/route.ts`:

```typescript
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "@/lib/prompt";

export const runtime = "nodejs";

async function generateGemini(question: string, apiKey: string, config: { modelName?: string; temperature?: number }) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContentStream({
    model: config.modelName || "gemini-2.5-flash",
    contents: question,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: config.temperature ?? 0.7,
    },
  });

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response) {
          if (chunk.text) {
            controller.enqueue(new TextEncoder().encode(chunk.text));
          }
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成过程中出错";
        controller.enqueue(new TextEncoder().encode(`\n\n---\n**错误**: ${message}`));
        controller.close();
      }
    },
  });
}

async function generateQwen(question: string, apiKey: string, config: { modelName?: string; temperature?: number }) {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });

  const response = await client.chat.completions.create({
    model: config.modelName || "qwen-plus",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ],
    temperature: config.temperature ?? 0.7,
    stream: true,
  });

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成过程中出错";
        controller.enqueue(new TextEncoder().encode(`\n\n---\n**错误**: ${message}`));
        controller.close();
      }
    },
  });
}

export async function POST(req: Request) {
  try {
    const { question, apiKey, provider, config } = await req.json();

    if (!apiKey) {
      return Response.json(
        { error: `请先在设置中配置 ${provider === "qwen" ? "DashScope" : "Gemini"} API Key` },
        { status: 400 }
      );
    }

    if (!question?.trim()) {
      return Response.json({ error: "请输入面试题目" }, { status: 400 });
    }

    const stream = provider === "qwen"
      ? await generateQwen(question.trim(), apiKey, config || {})
      : await generateGemini(question.trim(), apiKey, config || {});

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "服务器错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 3: Test manually**

Run the dev server and test with:
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"question":"test","apiKey":"test-key","provider":"qwen","config":{"modelName":"qwen-plus"}}' \
  --max-time 5
```
Expected: Error about invalid API key (confirms route is reachable and provider routing works).

**Step 4: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat: add Qwen provider support to generate API via DashScope OpenAI-compatible endpoint"
```

---

### Task 4: Add TTS API Route

**Files:**
- Create: `src/app/api/tts/route.ts`

**Step 1: Create TTS API route**

Create `src/app/api/tts/route.ts`:

```typescript
import WebSocket from "ws";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";

export async function POST(req: Request) {
  try {
    const { text, apiKey, model, voice } = await req.json();

    if (!apiKey) {
      return Response.json({ error: "请先配置 DashScope API Key" }, { status: 400 });
    }
    if (!text?.trim()) {
      return Response.json({ error: "缺少朗读文本" }, { status: 400 });
    }

    const taskId = randomUUID();
    const audioChunks: Buffer[] = [];

    const audioData = await new Promise<Buffer>((resolve, reject) => {
      const ws = new WebSocket(WS_URL, {
        headers: { Authorization: `bearer ${apiKey}` },
      });

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("TTS 请求超时"));
      }, 60000);

      ws.on("open", () => {
        // Step 1: run-task
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
            model: model || "cosyvoice-v3.5-flash",
            parameters: {
              text_type: "PlainText",
              voice: voice || "longanyang",
              format: "mp3",
              sample_rate: 22050,
              volume: 50,
              rate: 1.0,
              pitch: 1.0,
            },
            input: {},
          },
        }));
      });

      ws.on("message", (data: WebSocket.Data, isBinary: boolean) => {
        if (isBinary) {
          audioChunks.push(Buffer.from(data as ArrayBuffer));
        } else {
          const msg = JSON.parse(data.toString());
          const event = msg.header?.event;

          if (event === "task-started") {
            // Send text
            ws.send(JSON.stringify({
              header: {
                action: "continue-task",
                task_id: taskId,
                streaming: "duplex",
              },
              payload: {
                input: { text: text.trim() },
              },
            }));
            // Finish
            ws.send(JSON.stringify({
              header: {
                action: "finish-task",
                task_id: taskId,
                streaming: "duplex",
              },
              payload: { input: {} },
            }));
          } else if (event === "task-finished") {
            clearTimeout(timeout);
            ws.close();
            resolve(Buffer.concat(audioChunks));
          } else if (event === "task-failed") {
            clearTimeout(timeout);
            ws.close();
            const errMsg = msg.header?.error_message || msg.payload?.output?.message || "TTS 合成失败";
            reject(new Error(errMsg));
          }
        }
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket 错误: ${err.message}`));
      });

      ws.on("close", (code) => {
        clearTimeout(timeout);
        if (audioChunks.length === 0 && code !== 1000) {
          reject(new Error(`连接异常关闭 (code: ${code})`));
        }
      });
    });

    return new Response(audioData, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioData.length),
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS 服务错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/app/api/tts/route.ts
git commit -m "feat: add TTS API route proxying DashScope CosyVoice WebSocket"
```

---

### Task 5: Add Audio Cache (IndexedDB)

**Files:**
- Create: `src/lib/audio-cache.ts`

**Step 1: Create audio cache module**

Create `src/lib/audio-cache.ts`:

```typescript
import { get, set, del } from "idb-keyval";

const CACHE_PREFIX = "tts_";

function hashText(text: string, voice: string, model: string): string {
  // Simple hash: use first 100 chars + length + voice + model
  const key = `${text.slice(0, 100)}_${text.length}_${voice}_${model}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return String(Math.abs(hash));
}

export interface CachedAudio {
  blob: Blob;
  textHash: string;
  voice: string;
  model: string;
  createdAt: string;
}

export async function getCachedAudio(
  answerId: string,
  text: string,
  voice: string,
  model: string
): Promise<Blob | null> {
  try {
    const cached = await get<CachedAudio>(`${CACHE_PREFIX}${answerId}`);
    if (!cached) return null;

    const currentHash = hashText(text, voice, model);
    if (cached.textHash !== currentHash) {
      await del(`${CACHE_PREFIX}${answerId}`);
      return null;
    }

    return cached.blob;
  } catch {
    return null;
  }
}

export async function setCachedAudio(
  answerId: string,
  blob: Blob,
  text: string,
  voice: string,
  model: string
): Promise<void> {
  try {
    const entry: CachedAudio = {
      blob,
      textHash: hashText(text, voice, model),
      voice,
      model,
      createdAt: new Date().toISOString(),
    };
    await set(`${CACHE_PREFIX}${answerId}`, entry);
  } catch {
    // Silently fail — cache is optional
  }
}

export async function deleteCachedAudio(answerId: string): Promise<void> {
  try {
    await del(`${CACHE_PREFIX}${answerId}`);
  } catch {
    // Silently fail
  }
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/audio-cache.ts
git commit -m "feat: add IndexedDB audio cache for TTS results"
```

---

### Task 6: Create useTTS Hook

**Files:**
- Create: `src/hooks/useTTS.ts`

**Step 1: Create the hook**

Create `src/hooks/useTTS.ts`:

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import { Settings } from "@/lib/types";
import { getCachedAudio, setCachedAudio } from "@/lib/audio-cache";

export type TTSStatus = "idle" | "loading" | "playing" | "paused";

export function useTTS() {
  const [status, setStatus] = useState<TTSStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const speak = useCallback(
    async (answerId: string, text: string, settings: Settings) => {
      cleanup();
      setError(null);
      setStatus("loading");

      try {
        // Check cache first
        let blob = await getCachedAudio(
          answerId,
          text,
          settings.ttsVoice,
          settings.ttsModel
        );

        if (!blob) {
          // Fetch from API
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              apiKey: settings.dashscopeApiKey,
              model: settings.ttsModel,
              voice: settings.ttsVoice,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: "TTS 请求失败" }));
            throw new Error(errData.error || `HTTP ${res.status}`);
          }

          blob = await res.blob();

          // Cache for next time
          await setCachedAudio(answerId, blob, text, settings.ttsVoice, settings.ttsModel);
        }

        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        const audio = new Audio(url);
        audio.playbackRate = settings.ttsRate;
        audioRef.current = audio;

        audio.onended = () => {
          setStatus("idle");
        };
        audio.onerror = () => {
          setStatus("idle");
          setError("音频播放失败");
        };

        await audio.play();
        setStatus("playing");
      } catch (err) {
        const message = err instanceof Error ? err.message : "TTS 失败";
        setError(message);
        setStatus("idle");
      }
    },
    [cleanup]
  );

  const pause = useCallback(() => {
    if (audioRef.current && status === "playing") {
      audioRef.current.pause();
      setStatus("paused");
    }
  }, [status]);

  const resume = useCallback(() => {
    if (audioRef.current && status === "paused") {
      audioRef.current.play();
      setStatus("playing");
    }
  }, [status]);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  const setRate = useCallback((rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  return {
    status,
    error,
    speak,
    pause,
    resume,
    stop,
    setRate,
    clearError: useCallback(() => setError(null), []),
  };
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/hooks/useTTS.ts
git commit -m "feat: add useTTS hook for audio playback with caching"
```

---

### Task 7: Add TTS Button to AnswerSection

**Files:**
- Modify: `src/components/AnswerSection.tsx`
- Modify: `src/components/AnswerCard.tsx`

**Step 1: Update AnswerSection to accept TTS props and render speak button**

Replace the entire `src/components/AnswerSection.tsx`:

```typescript
"use client";

import { useState } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { CopyButton } from "./CopyButton";
import { Icon } from "./Icon";
import { TTSStatus } from "@/hooks/useTTS";

interface AnswerSectionProps {
  title: string;
  content: string;
  icon?: string;
  defaultOpen?: boolean;
  // TTS props — only provided for "考生作答" section
  ttsStatus?: TTSStatus;
  onSpeak?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}

export function AnswerSection({
  title,
  content,
  icon = "",
  defaultOpen = true,
  ttsStatus,
  onSpeak,
  onPause,
  onResume,
  onStop,
}: AnswerSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!content.trim()) return null;

  const showTTS = !!onSpeak;

  const ttsButton = () => {
    if (!showTTS) return null;

    if (ttsStatus === "loading") {
      return (
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-amber-600 bg-amber-50 cursor-wait"
        >
          <Icon name="progress_activity" size={16} className="animate-spin" />
          <span className="hidden sm:inline">合成中</span>
        </button>
      );
    }

    if (ttsStatus === "playing") {
      return (
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={onPause}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <Icon name="pause" size={16} />
            <span className="hidden sm:inline">暂停</span>
          </button>
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-zinc-500 bg-zinc-100 hover:bg-zinc-200 transition-colors"
          >
            <Icon name="stop" size={16} />
          </button>
        </div>
      );
    }

    if (ttsStatus === "paused") {
      return (
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
          >
            <Icon name="play_arrow" size={16} />
            <span className="hidden sm:inline">继续</span>
          </button>
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-zinc-500 bg-zinc-100 hover:bg-zinc-200 transition-colors"
          >
            <Icon name="stop" size={16} />
          </button>
        </div>
      );
    }

    // idle
    return (
      <button
        type="button"
        onClick={onSpeak}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-zinc-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
        title="朗读此段作答"
      >
        <Icon name="volume_up" size={16} />
        <span className="hidden sm:inline">朗读</span>
      </button>
    );
  };

  return (
    <div className="py-3 sm:py-4 border-b border-zinc-100/80 last:border-b-0">
      {/* Section header — clickable to toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 min-w-0 flex-1 text-left py-1 -my-1 cursor-pointer"
          onClick={() => setOpen(!open)}
        >
          {icon && <span className="text-base shrink-0">{icon}</span>}
          <span className="font-semibold text-sm text-zinc-800 truncate">
            {title}
          </span>
          <Icon
            name={open ? "expand_more" : "chevron_right"}
            size={18}
            className="text-zinc-400 shrink-0"
          />
        </button>
        <div className="shrink-0 ml-2 flex items-center gap-1">
          {ttsButton()}
          <CopyButton text={content} variant="ghost" />
        </div>
      </div>
      {/* Section content */}
      {open && (
        <div className="mt-2 sm:mt-3">
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Update AnswerCard to pass TTS props to the "考生作答" section**

Modify `src/components/AnswerCard.tsx`. Add new props to the interface and pass them to the first AnswerSection.

Add to imports at top of file:
```typescript
import { TTSStatus } from "@/hooks/useTTS";
```

Update the AnswerCardProps interface (line 14-20):
```typescript
interface AnswerCardProps {
  pair: QAPair;
  isStreaming?: boolean;
  streamText?: string;
  onToggleFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  // TTS
  ttsStatus?: TTSStatus;
  onSpeak?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}
```

Update the component destructuring (line 22-28):
```typescript
export function AnswerCard({
  pair,
  isStreaming = false,
  streamText = "",
  onToggleFavorite,
  onDelete,
  ttsStatus,
  onSpeak,
  onPause,
  onResume,
  onStop,
}: AnswerCardProps) {
```

Update the first AnswerSection (line 147-151) to pass TTS props:
```typescript
            <AnswerSection
              title="考生作答（现场口吻）"
              content={sections.answer}
              icon="🎙️"
              ttsStatus={ttsStatus}
              onSpeak={onSpeak}
              onPause={onPause}
              onResume={onResume}
              onStop={onStop}
            />
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/AnswerSection.tsx src/components/AnswerCard.tsx
git commit -m "feat: add TTS speak/pause/stop button to 考生作答 section"
```

---

### Task 8: Wire TTS into Main Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Import useTTS and wire to AnswerCard**

In `src/app/page.tsx`, add import:
```typescript
import { useTTS } from "@/hooks/useTTS";
```

Inside `Home()`, add the hook (after the useGenerate line, ~line 21):
```typescript
  const { status: ttsStatus, error: ttsError, speak, pause, resume, stop: stopTTS, setRate, clearError: clearTTSError } = useTTS();
```

Add a handleSpeak callback (after handleSubmit, before selectedPair):
```typescript
  const handleSpeak = useCallback(() => {
    if (!displayPair) return;
    const text = displayPair.answer.sections.answer;
    if (!text.trim()) return;
    speak(displayPair.answer.id, text, settings);
  }, [displayPair, settings, speak]);
```

Update the AnswerCard render (around line 196-202) to pass TTS props:
```typescript
              <AnswerCard
                pair={displayPair}
                isStreaming={isGenerating && !!currentStreamPair}
                streamText={streamText}
                onToggleFavorite={currentStreamPair ? undefined : toggleFavorite}
                onDelete={currentStreamPair ? undefined : removePair}
                ttsStatus={currentStreamPair ? undefined : ttsStatus}
                onSpeak={currentStreamPair ? undefined : handleSpeak}
                onPause={currentStreamPair ? undefined : pause}
                onResume={currentStreamPair ? undefined : resume}
                onStop={currentStreamPair ? undefined : stopTTS}
              />
```

Add TTS error display (after the existing error block, ~line 192):
```typescript
              {ttsError && (
                <div className="bg-orange-50/80 border border-orange-200/60 rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                  <Icon name="volume_off" size={20} className="text-orange-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-orange-800">语音合成失败</p>
                    <p className="text-xs text-orange-600 mt-1 break-all">{ttsError}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearTTSError}
                    className="text-orange-500 hover:text-orange-700 h-8 w-8 shrink-0"
                  >
                    <Icon name="close" size={18} />
                  </Button>
                </div>
              )}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire TTS hook to AnswerCard on main page"
```

---

### Task 9: Redesign SettingsModal

**Files:**
- Modify: `src/components/SettingsModal.tsx`

**Step 1: Rewrite SettingsModal with three sections**

This is the largest UI change. Replace the entire `src/components/SettingsModal.tsx` with a redesigned version that has:

1. **Section 1: 文本生成** — Provider tabs (Gemini/Qwen), API key input, model dropdown
2. **Section 2: 语音合成** — DashScope API key, TTS model, voice picker, playback speed
3. **Section 3: 参数调节** — Temperature slider

Key changes:
- Add provider toggle tabs at the top of section 1
- When switching providers, auto-switch the modelName to a valid model for that provider
- Voice picker shows voice name + description
- Playback speed as discrete button group (0.75x, 1.0x, 1.25x, 1.5x, 2.0x)
- DashScope API key validation: attempt a simple API call to verify
- Import `TTS_MODELS`, `TTS_VOICES`, `TTS_RATES`, `QWEN_MODELS` from types

The full replacement code for this file is large. Here is the complete file:

```typescript
"use client";

import { Settings, TTS_VOICES, TTS_MODELS, TTS_RATES, TextProvider } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Icon } from "./Icon";
import { useState, useEffect, useCallback, useRef } from "react";

interface ModelInfo {
  id: string;
  name: string;
  description: string;
}

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => void;
  onReset: () => void;
}

export function SettingsModal({
  open,
  onOpenChange,
  settings,
  onUpdate,
  onReset,
}: SettingsModalProps) {
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showQwenKey, setShowQwenKey] = useState(false);
  const [showDashscopeKey, setShowDashscopeKey] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedKeyRef = useRef<string>("");

  const currentApiKey = settings.textProvider === "gemini" ? settings.geminiApiKey : settings.qwenApiKey;

  const fetchModels = useCallback(async (apiKey: string) => {
    if (!apiKey || apiKey.length < 10) {
      setModels([]);
      setModelsError(null);
      setKeyValid(null);
      return;
    }

    if (apiKey === lastFetchedKeyRef.current) return;

    setModelsLoading(true);
    setModelsError(null);
    setKeyValid(null);

    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, provider: settings.textProvider }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "获取模型失败");
      }

      setModels(data.models || []);
      setKeyValid(true);
      lastFetchedKeyRef.current = apiKey;

      if (data.models?.length > 0) {
        const currentValid = data.models.some(
          (m: ModelInfo) => m.id === settings.modelName
        );
        if (!currentValid) {
          onUpdate({ modelName: data.models[0].id });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "获取模型失败";
      setModelsError(msg);
      setKeyValid(false);
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [settings.textProvider, settings.modelName, onUpdate]);

  // Reset model state when switching providers
  const handleProviderSwitch = useCallback((provider: TextProvider) => {
    onUpdate({ textProvider: provider });
    setModels([]);
    setKeyValid(null);
    setModelsError(null);
    lastFetchedKeyRef.current = "";
    // Set a sensible default model for the provider
    if (provider === "gemini") {
      onUpdate({ textProvider: provider, modelName: "gemini-2.5-flash" });
    } else {
      onUpdate({ textProvider: provider, modelName: "qwen-plus" });
    }
  }, [onUpdate]);

  useEffect(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);

    if (!currentApiKey || currentApiKey.length < 10) {
      setModels([]);
      setKeyValid(null);
      setModelsError(null);
      lastFetchedKeyRef.current = "";
      return;
    }

    fetchTimerRef.current = setTimeout(() => {
      fetchModels(currentApiKey);
    }, 800);

    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    };
  }, [currentApiKey, fetchModels]);

  useEffect(() => {
    if (open && currentApiKey && currentApiKey.length >= 10 && models.length === 0) {
      fetchModels(currentApiKey);
    }
  }, [open, currentApiKey, models.length, fetchModels]);

  const sectionHeader = (num: number, title: string, active: boolean, icon: string) => (
    <div className="flex items-center gap-2">
      <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
        active ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-400"
      }`}>
        {num}
      </span>
      <Icon name={icon} size={18} className={active ? "text-amber-600" : "text-zinc-400"} />
      <span className="text-sm font-semibold text-stone-700">{title}</span>
    </div>
  );

  const keyInput = (
    value: string,
    onChange: (v: string) => void,
    show: boolean,
    onToggleShow: () => void,
    placeholder: string,
    valid: boolean | null,
    loading: boolean,
  ) => (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`font-mono text-sm pr-9 h-11 rounded-xl ${
            valid === true
              ? "border-green-300 focus-visible:ring-green-300"
              : valid === false
                ? "border-red-300 focus-visible:ring-red-300"
                : "focus-visible:ring-amber-300"
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading && <Icon name="progress_activity" size={16} className="text-amber-500 animate-spin" />}
          {!loading && valid === true && <Icon name="check_circle" size={16} className="text-green-500" />}
          {!loading && valid === false && <Icon name="cancel" size={16} className="text-red-400" />}
        </div>
      </div>
      <Button variant="outline" size="icon" onClick={onToggleShow} className="shrink-0 h-11 w-11 rounded-xl">
        <Icon name={show ? "visibility_off" : "visibility"} size={20} />
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-0 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Icon name="settings" size={18} className="text-white" />
            </div>
            模型设置
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 sm:px-6 sm:pb-6 space-y-6 mt-4">

          {/* === Section 1: Text Generation === */}
          <div className="space-y-3">
            {sectionHeader(1, "文本生成", true, "auto_awesome")}

            <div className="ml-8 space-y-3">
              {/* Provider tabs */}
              <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">
                {(["gemini", "qwen"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleProviderSwitch(p)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                      settings.textProvider === p
                        ? "bg-white text-amber-700 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {p === "gemini" ? "Google Gemini" : "通义千问 Qwen"}
                  </button>
                ))}
              </div>

              {/* API Key */}
              {settings.textProvider === "gemini" ? (
                <>
                  {keyInput(
                    settings.geminiApiKey,
                    (v) => onUpdate({ geminiApiKey: v }),
                    showGeminiKey,
                    () => setShowGeminiKey(!showGeminiKey),
                    "AIzaSy...",
                    keyValid,
                    modelsLoading,
                  )}
                  {keyValid === null && !modelsLoading && (
                    <p className="text-xs text-zinc-400">
                      从{" "}
                      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                         className="text-amber-600 hover:text-amber-700 underline underline-offset-2">
                        Google AI Studio
                      </a>{" "}获取免费 API Key
                    </p>
                  )}
                </>
              ) : (
                <>
                  {keyInput(
                    settings.qwenApiKey,
                    (v) => onUpdate({ qwenApiKey: v }),
                    showQwenKey,
                    () => setShowQwenKey(!showQwenKey),
                    "sk-...",
                    keyValid,
                    modelsLoading,
                  )}
                  {keyValid === null && !modelsLoading && (
                    <p className="text-xs text-zinc-400">
                      从{" "}
                      <a href="https://bailian.console.aliyun.com/?apiKey=1#/api-key" target="_blank" rel="noopener noreferrer"
                         className="text-amber-600 hover:text-amber-700 underline underline-offset-2">
                        阿里云百炼
                      </a>{" "}获取 API Key
                    </p>
                  )}
                </>
              )}

              {modelsError && (
                <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50/80 rounded-lg px-3 py-2">
                  <Icon name="error" size={14} className="shrink-0 mt-0.5" />
                  {modelsError}
                </div>
              )}

              {/* Model select */}
              {models.length > 0 ? (
                <>
                  <Select value={settings.modelName} onValueChange={(v) => onUpdate({ modelName: v })}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex flex-col">
                            <span className="text-sm">{m.id}</span>
                            {m.description && (
                              <span className="text-[10px] text-zinc-400 truncate max-w-[320px]">
                                {m.description.slice(0, 80)}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-zinc-400">
                    当前: <span className="font-mono text-amber-700">{settings.modelName}</span>
                  </p>
                </>
              ) : (
                <div className="border border-dashed border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-400 text-center">
                  {modelsLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Icon name="progress_activity" size={16} className="animate-spin text-amber-500" />
                      正在加载模型列表...
                    </span>
                  ) : currentApiKey ? (
                    "请输入有效的 API Key"
                  ) : (
                    "请先输入 API Key"
                  )}
                </div>
              )}
            </div>
          </div>

          {/* === Section 2: TTS === */}
          <div className="space-y-3">
            {sectionHeader(2, "语音合成", !!settings.dashscopeApiKey, "volume_up")}

            <div className="ml-8 space-y-3">
              {/* DashScope key */}
              {keyInput(
                settings.dashscopeApiKey,
                (v) => onUpdate({ dashscopeApiKey: v }),
                showDashscopeKey,
                () => setShowDashscopeKey(!showDashscopeKey),
                "sk-...",
                settings.dashscopeApiKey.length >= 10 ? true : null,
                false,
              )}
              <p className="text-xs text-zinc-400">
                用于 CosyVoice 语音合成，从{" "}
                <a href="https://bailian.console.aliyun.com/?apiKey=1#/api-key" target="_blank" rel="noopener noreferrer"
                   className="text-amber-600 hover:text-amber-700 underline underline-offset-2">
                  阿里云百炼
                </a>{" "}获取
              </p>

              {/* TTS Model */}
              <Select value={settings.ttsModel} onValueChange={(v) => onUpdate({ ttsModel: v })}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="选择语音模型" />
                </SelectTrigger>
                <SelectContent>
                  {TTS_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Voice picker */}
              <Select value={settings.ttsVoice} onValueChange={(v) => onUpdate({ ttsVoice: v })}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="选择音色" />
                </SelectTrigger>
                <SelectContent>
                  {TTS_VOICES.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{v.label}</span>
                        <span className="text-[10px] text-zinc-400">{v.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Playback speed */}
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">播放速度</p>
                <div className="flex gap-1">
                  {TTS_RATES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => onUpdate({ ttsRate: r.value })}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        settings.ttsRate === r.value
                          ? "bg-amber-500 text-white shadow-sm"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* === Section 3: Temperature === */}
          <div className="space-y-3">
            {sectionHeader(3, "创造性调节", true, "tune")}

            <div className="ml-8 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">温度参数</span>
                <span className="text-sm font-mono font-semibold text-amber-700">
                  {settings.temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[settings.temperature]}
                onValueChange={([v]) => onUpdate({ temperature: v })}
                min={0}
                max={2}
                step={0.1}
                className="py-2"
              />
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>严谨稳定</span>
                <span className="text-amber-600 font-medium">面试推荐 0.5-0.8</span>
                <span>发散创意</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 h-9"
            >
              <Icon name="restart_alt" size={16} />
              恢复默认
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl h-10 px-5 text-sm shadow-sm"
            >
              完成设置
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat: redesign SettingsModal with provider switch, TTS config, and voice picker"
```

---

### Task 10: Update Models API Route for Qwen

**Files:**
- Modify: `src/app/api/models/route.ts`

**Step 1: Add Qwen model listing support**

Replace the entire `src/app/api/models/route.ts`:

```typescript
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { apiKey, provider } = await req.json();

    if (!apiKey) {
      return Response.json({ error: "缺少 API Key" }, { status: 400 });
    }

    if (provider === "qwen") {
      return await listQwenModels(apiKey);
    }

    return await listGeminiModels(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取模型列表失败";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function listGeminiModels(apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const pager = await ai.models.list({ config: { pageSize: 100 } });

  const models: { id: string; name: string; description: string }[] = [];

  for await (const model of pager) {
    if (
      model.name &&
      model.supportedActions?.includes("generateContent") &&
      /gemini/i.test(model.name)
    ) {
      const id = model.name.replace(/^models\//, "");
      models.push({
        id,
        name: model.displayName || id,
        description: model.description || "",
      });
    }
  }

  models.sort((a, b) => {
    const rank = (id: string) => {
      if (id.includes("2.5-pro")) return 0;
      if (id.includes("2.5-flash-lite")) return 2;
      if (id.includes("2.5-flash")) return 1;
      if (id.includes("2.0-flash")) return 3;
      return 10;
    };
    return rank(a.id) - rank(b.id);
  });

  return Response.json({ models });
}

async function listQwenModels(apiKey: string) {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });

    const list = await client.models.list();
    const models: { id: string; name: string; description: string }[] = [];

    for await (const model of list) {
      if (/^qwen/i.test(model.id)) {
        models.push({
          id: model.id,
          name: model.id,
          description: "",
        });
      }
    }

    // Sort: preferred models first
    models.sort((a, b) => {
      const rank = (id: string) => {
        if (id === "qwen-max") return 0;
        if (id === "qwen-plus") return 1;
        if (id === "qwen-turbo") return 2;
        if (id.includes("max")) return 3;
        if (id.includes("plus")) return 4;
        if (id.includes("turbo")) return 5;
        return 10;
      };
      return rank(a.id) - rank(b.id);
    });

    return Response.json({ models });
  } catch {
    // Fallback: return hardcoded list (DashScope may not support model listing)
    const fallback = [
      { id: "qwen-max", name: "Qwen Max", description: "最强推理能力" },
      { id: "qwen-plus", name: "Qwen Plus", description: "推荐 - 性能均衡" },
      { id: "qwen-turbo", name: "Qwen Turbo", description: "最快响应速度" },
      { id: "qwen3-max", name: "Qwen3 Max", description: "最新旗舰" },
      { id: "qwen3.5-plus", name: "Qwen3.5 Plus", description: "最新 Plus" },
    ];
    return Response.json({ models: fallback });
  }
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/api/models/route.ts
git commit -m "feat: add Qwen model listing to models API route"
```

---

### Task 11: Update Auto-Open Settings Logic

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Fix auto-open settings to check based on active provider**

In `src/app/page.tsx`, update the useEffect that auto-opens settings (around line 31-35):

```typescript
  useEffect(() => {
    if (settingsLoaded) {
      const hasKey = settings.textProvider === "gemini"
        ? !!settings.geminiApiKey
        : !!settings.qwenApiKey;
      if (!hasKey) setSettingsOpen(true);
    }
  }, [settingsLoaded, settings.textProvider, settings.geminiApiKey, settings.qwenApiKey]);
```

Also update the check in handleSubmit (around line 46-49):

```typescript
      const hasKey = settings.textProvider === "gemini"
        ? !!settings.geminiApiKey
        : !!settings.qwenApiKey;
      if (!hasKey) {
        setSettingsOpen(true);
        return;
      }
```

And update the `disabled` prop on QuestionInput (around line 170):

```typescript
                disabled={settings.textProvider === "gemini" ? !settings.geminiApiKey : !settings.qwenApiKey}
```

And update the empty state "先配置 API Key" button condition (around line 216):

```typescript
                    {(settings.textProvider === "gemini" ? !settings.geminiApiKey : !settings.qwenApiKey) && (
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix: update API key checks to respect active text provider"
```

---

### Task 12: Full Integration Test

**Step 1: Start dev server and test in browser**

Run: `npm run dev`

Open http://localhost:3000

**Step 2: Test checklist**

1. Open Settings → verify provider tabs work (Gemini/Qwen switch)
2. Enter a Gemini API key → verify models load
3. Switch to Qwen → enter DashScope key → verify models load
4. Enter DashScope API key for TTS section
5. Select voice and playback speed
6. Submit a question → verify streaming works with selected provider
7. After answer loads → click "朗读" on "考生作答" section
8. Verify audio plays, pause/resume/stop work
9. Click "朗读" again → verify cached audio plays (no loading delay)
10. Change voice in settings → click "朗读" → verify new voice (cache invalidated)

**Step 3: Test build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: integration fixes for TTS and Qwen support"
```
