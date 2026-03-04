# TTS 朗读 + Qwen 文本生成支持

## 需求

1. "考生作答"板块新增朗读按钮，接入 DashScope CosyVoice TTS
2. 文本生成模型支持 Qwen（通义千问），与 Gemini 并存可切换
3. 音色可选（预设 + 自定义克隆）
4. 播放速度可调
5. 已生成音频缓存，文本不变不重新生成

## 架构

### TTS 朗读

```
点击朗读
  → 检查 IndexedDB 缓存（key = hash(text + voice + model)）
  → 命中 → 直接播放
  → 未命中 → POST /api/tts {text, apiKey, model, voice}
           → Node.js WebSocket → DashScope CosyVoice
           → 收集 audio chunks → 返回 mp3
           → 缓存到 IndexedDB
           → 播放
```

**API Route: `/api/tts`**
- 接收：text, dashscopeApiKey, ttsModel, ttsVoice
- 用 `ws` npm 包连接 `wss://dashscope.aliyuncs.com/api-ws/v1/inference/`
- 发送 run-task → continue-task (text) → finish-task
- 收集 binary frames，合并后返回 audio/mpeg

**前端播放**
- `useTTS` hook：管理状态（idle/loading/playing/paused）
- Web Audio API 或 HTMLAudioElement 播放
- 播放速度：Audio.playbackRate（0.75, 1.0, 1.25, 1.5, 2.0）

**音频缓存**
- IndexedDB 存储（localStorage 有 5MB 限制不适合音频）
- store: `tts_cache`
- key: `${answerId}`
- value: `{ audioBlob: Blob, textHash: string, voice: string, model: string }`
- 文本或音色/模型变化时失效重新生成

### Qwen 文本生成

**方案**：用 `openai` npm 包指向 DashScope OpenAI 兼容接口

```
base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
api_key: 用户的 DashScope/Qwen API Key
model: qwen-plus / qwen-max 等
stream: true
```

**`/api/generate` 修改**
- 新增 `provider` 参数：`"gemini" | "qwen"`
- gemini 路径：保持现有 `@google/genai` 逻辑
- qwen 路径：`openai` SDK → DashScope 兼容接口 → 流式输出

**`/api/models` 修改**
- 接受 `provider` 参数
- qwen 路径：调 DashScope `/compatible-mode/v1/models` 列表
- 或提供预设列表（qwen-max, qwen-plus, qwen-turbo 等）

## Settings 扩展

```typescript
interface Settings {
  // 文本生成
  textProvider: "gemini" | "qwen";
  geminiApiKey: string;
  qwenApiKey: string;
  modelName: string;
  temperature: number;
  // TTS
  dashscopeApiKey: string;
  ttsModel: string;       // default: "cosyvoice-v3.5-flash"
  ttsVoice: string;       // default: "longanyang"
  ttsRate: number;         // default: 1.0
}
```

## 新增依赖

- `openai` — Qwen via DashScope 兼容接口
- `ws` + `@types/ws` — Node.js WebSocket（API Route 连 DashScope TTS）
- `idb-keyval` — 轻量 IndexedDB wrapper（音频缓存）

## UI 改动

### SettingsModal 重构
分三区：
1. **文本生成** — Provider 切换（Gemini/Qwen）→ 对应 API Key → 模型选择
2. **语音合成** — DashScope API Key → TTS 模型 → 音色选择 → 播放速度
3. **其他** — Temperature 等

### AnswerSection
- "考生作答"section 标题栏增加朗读按钮（speaker icon）
- 播放状态：idle → 朗读图标 / loading → spinner / playing → 暂停图标
- 播放速度显示 badge

### AnswerCard
- 传递 dashscope settings + answerId 给 AnswerSection

## 预设音色列表

| voice ID | 描述 |
|----------|------|
| longanyang | 阳光男声（推荐） |
| longxiaochun_v2 | 温柔女声 |
| longhua | 标准男声 |
| longwan | 知性女声 |
| longjing | 播音男声 |
| longshuo | 有声书男声 |
| longmiao | 有声书女声 |

## CosyVoice 预设模型

| 模型 | 特点 |
|------|------|
| cosyvoice-v3.5-flash | 速度快，推荐 |
| cosyvoice-v3.5-plus | 质量最佳 |
