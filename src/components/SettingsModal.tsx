"use client";

import { Settings, TTS_MODELS, TTS_RATES, TTS_VOICES_FALLBACK, TextProvider, type CustomVoice } from "@/lib/types";
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
  const [ttsModels, setTtsModels] = useState<ModelInfo[]>([]);
  const [ttsModelsLoading, setTtsModelsLoading] = useState(false);
  const lastFetchedTtsKeyRef = useRef<string>("");

  interface VoiceInfo {
    id: string;
    name: string;
    category: string;
    instruct: boolean;
    timestamp: boolean;
  }
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesMessage, setVoicesMessage] = useState<string | null>(null);
  const lastFetchedVoiceModelRef = useRef<string>("");

  // Voice cloning state
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  const [cloneMode, setCloneMode] = useState<"url" | "id">("url");
  const [cloneName, setCloneName] = useState("我的音色");
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneVoiceId, setCloneVoiceId] = useState("");
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

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

  const fetchTTSModels = useCallback(async (apiKey: string) => {
    if (!apiKey || apiKey.length < 10) {
      setTtsModels([]);
      return;
    }
    if (apiKey === lastFetchedTtsKeyRef.current) return;

    setTtsModelsLoading(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, provider: "tts" }),
      });
      const data = await res.json();
      if (data.models?.length > 0) {
        setTtsModels(data.models);
        lastFetchedTtsKeyRef.current = apiKey;
        const currentValid = data.models.some((m: ModelInfo) => m.id === settings.ttsModel);
        if (!currentValid) {
          onUpdate({ ttsModel: data.models[0].id });
        }
      }
    } catch {
      // Use fallback from TTS_MODELS constant
    } finally {
      setTtsModelsLoading(false);
    }
  }, [settings.ttsModel, onUpdate]);

  const fetchVoices = useCallback(async (model: string) => {
    if (model === lastFetchedVoiceModelRef.current) return;

    setVoicesLoading(true);
    setVoicesMessage(null);
    try {
      const res = await fetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      const data = await res.json();
      if (data.message) {
        setVoicesMessage(data.message);
        setVoices([]);
      } else {
        setVoices(data.voices || []);
        lastFetchedVoiceModelRef.current = model;
        if (data.voices?.length > 0) {
          const currentValid = data.voices.some((v: VoiceInfo) => v.id === settings.ttsVoice);
          if (!currentValid) {
            onUpdate({ ttsVoice: data.voices[0].id });
          }
        }
      }
    } catch {
      setVoices([]);
    } finally {
      setVoicesLoading(false);
    }
  }, [settings.ttsVoice, onUpdate]);

  const fetchCustomVoices = useCallback(async () => {
    try {
      const res = await fetch("/api/voice-clone/list");
      const data = await res.json();
      setCustomVoices(data.voices || []);
    } catch {
      // silent fail
    }
  }, []);

  // Fetch TTS models when dashscope key changes
  useEffect(() => {
    if (settings.dashscopeApiKey && settings.dashscopeApiKey.length >= 10) {
      fetchTTSModels(settings.dashscopeApiKey);
    }
  }, [settings.dashscopeApiKey, fetchTTSModels]);

  // Fetch voices when TTS model changes; auto-fix v3.5 models
  useEffect(() => {
    if (settings.ttsModel.includes("v3.5")) {
      onUpdate({ ttsModel: "cosyvoice-v3-flash" });
      return;
    }
    fetchVoices(settings.ttsModel);
  }, [settings.ttsModel, fetchVoices, onUpdate]);

  // Fetch custom voices when modal opens
  useEffect(() => {
    if (open) {
      fetchCustomVoices();
    }
  }, [open, fetchCustomVoices]);

  const handleProviderSwitch = useCallback((provider: TextProvider) => {
    setModels([]);
    setKeyValid(null);
    setModelsError(null);
    lastFetchedKeyRef.current = "";
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

  // Voice cloning handler
  const handleClone = useCallback(async () => {
    if (!cloneName.trim()) {
      setCloneError("请输入音色名称");
      return;
    }

    setCloneLoading(true);
    setCloneError(null);
    setCloneSuccess(null);

    try {
      if (cloneMode === "id") {
        // Direct voice_id mode — save via API
        if (!cloneVoiceId.trim()) {
          throw new Error("请输入 voice_id");
        }

        const res = await fetch("/api/voice-clone/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voiceId: cloneVoiceId.trim(),
            name: cloneName.trim(),
            targetModel: settings.ttsModel,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "保存失败");
        }

        await fetchCustomVoices();
        setCloneSuccess(`音色"${cloneName.trim()}"添加成功！`);
        onUpdate({
          ttsVoice: cloneVoiceId.trim(),
          customVoiceTargetModel: settings.ttsModel,
          customVoiceName: cloneName.trim() + " (自定义)",
        });
      } else {
        // URL mode — call DashScope API
        if (!settings.dashscopeApiKey) {
          throw new Error("请先配置 DashScope API Key");
        }
        if (!cloneUrl.trim()) {
          throw new Error("请输入音频公网 URL");
        }

        const res = await fetch("/api/voice-clone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioUrl: cloneUrl.trim(),
            name: cloneName.trim(),
            apiKey: settings.dashscopeApiKey,
            targetModel: settings.ttsModel,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        setCloneSuccess(`音色"${data.name}"复刻成功！`);
        await fetchCustomVoices();
        onUpdate({
          ttsVoice: data.voiceId,
          customVoiceTargetModel: data.targetModel,
          customVoiceName: data.name + " (自定义)",
        });
      }

      setCloneUrl("");
      setCloneVoiceId("");
      setCloneName("我的音色");
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : "声音复刻失败");
    } finally {
      setCloneLoading(false);
    }
  }, [cloneMode, cloneVoiceId, cloneUrl, cloneName, settings.dashscopeApiKey, settings.ttsModel, fetchCustomVoices, onUpdate]);

  const handleDeleteVoice = useCallback(async (voiceId: string) => {
    try {
      await fetch(`/api/voice-clone/list?voiceId=${encodeURIComponent(voiceId)}`, {
        method: "DELETE",
      });
      await fetchCustomVoices();
      // If deleted voice was selected, reset to default
      if (settings.ttsVoice === voiceId) {
        onUpdate({
          ttsVoice: "longanxuan_v3",
          customVoiceTargetModel: "",
          customVoiceName: "",
        });
      }
    } catch { /* ignore */ }
  }, [settings.ttsVoice, onUpdate, fetchCustomVoices]);

  const handleSelectVoice = useCallback((voiceId: string) => {
    // Check if it's a custom voice
    const custom = customVoices.find((v) => v.voiceId === voiceId);
    if (custom) {
      onUpdate({
        ttsVoice: voiceId,
        customVoiceTargetModel: custom.targetModel,
        customVoiceName: custom.name + " (自定义)",
      });
    } else {
      onUpdate({
        ttsVoice: voiceId,
        customVoiceTargetModel: "",
        customVoiceName: "",
      });
    }
  }, [customVoices, onUpdate]);

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

              <Select value={settings.ttsModel} onValueChange={(v) => onUpdate({ ttsModel: v })}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder={ttsModelsLoading ? "加载模型中..." : "选择语音模型"} />
                </SelectTrigger>
                <SelectContent>
                  {(ttsModels.length > 0 ? ttsModels : TTS_MODELS.map(m => ({ id: m.value, name: m.label, description: "" }))).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="text-sm">{m.name || m.id}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Voice selector with custom voices */}
              {voicesMessage ? (
                <div className="text-xs text-amber-600 bg-amber-50/80 rounded-lg px-3 py-2">
                  {voicesMessage}
                </div>
              ) : (
                <Select value={settings.ttsVoice} onValueChange={handleSelectVoice}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder={voicesLoading ? "加载音色中..." : "选择音色"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {/* Custom voices first */}
                    {customVoices.length > 0 && (
                      <>
                        {customVoices.map((cv) => (
                          <SelectItem key={cv.voiceId} value={cv.voiceId}>
                            <div className="flex items-center gap-2">
                              <Icon name="mic" size={14} className="text-amber-600" />
                              <span className="text-sm font-medium">{cv.name}</span>
                              <span className="text-[10px] text-amber-600">自定义</span>
                            </div>
                          </SelectItem>
                        ))}
                        <div className="border-t border-zinc-100 my-1" />
                      </>
                    )}
                    {/* System voices */}
                    {(voices.length > 0 ? voices : TTS_VOICES_FALLBACK).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{v.name}</span>
                          <span className="text-[10px] text-zinc-400">{v.category}</span>
                          {v.instruct && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-600">Instruct</span>
                          )}
                          {v.timestamp && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-green-50 text-green-600">时间戳</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

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

          {/* === Section 3: Voice Cloning === */}
          <div className="space-y-3">
            {sectionHeader(3, "声音复刻", !!settings.dashscopeApiKey, "mic")}

            <div className="ml-8 space-y-3">
              {/* Guide toggle */}
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 transition-colors"
              >
                <Icon name={showGuide ? "expand_more" : "help"} size={14} />
                {showGuide ? "收起教程" : "如何获取音频 URL？"}
              </button>

              {showGuide && (
                <div className="bg-amber-50/60 border border-amber-100/60 rounded-xl p-3 space-y-2 text-xs text-zinc-600">
                  <p className="font-semibold text-amber-800">方式 A：通过音频 URL 复刻（推荐）</p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                    <li>录制一段 <b>10-20秒</b> 清晰朗读的音频（MP3/WAV/M4A）</li>
                    <li>上传到任意公网存储（如阿里云 OSS、七牛云等），获取公网 URL</li>
                    <li>将 URL 粘贴到下方输入框，点击「开始复刻」</li>
                  </ol>
                  <div className="border-t border-amber-100/60 pt-2 mt-2">
                    <p className="font-semibold text-amber-800">方式 B：直接粘贴 voice_id</p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                      <li>
                        登录{" "}
                        <a href="https://bailian.console.aliyun.com/" target="_blank" rel="noopener noreferrer"
                           className="text-amber-600 underline underline-offset-2">
                          阿里云百炼控制台
                        </a>
                        ，在语音合成中完成声音复刻
                      </li>
                      <li>复制生成的 voice_id（格式如 cosyvoice-v3-flash-xxx-yyy）</li>
                      <li>切换到「粘贴 voice_id」模式，粘贴并保存</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Mode tabs */}
              <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCloneMode("url")}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    cloneMode === "url"
                      ? "bg-white text-amber-700 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  音频 URL 复刻
                </button>
                <button
                  type="button"
                  onClick={() => setCloneMode("id")}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    cloneMode === "id"
                      ? "bg-white text-amber-700 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  粘贴 voice_id
                </button>
              </div>

              {/* Name input */}
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">音色名称</p>
                <Input
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="给你的音色起个名字"
                  className="h-10 rounded-xl text-sm"
                />
              </div>

              {cloneMode === "url" ? (
                <div>
                  <p className="text-xs text-zinc-500 mb-1.5">音频公网 URL</p>
                  <Input
                    value={cloneUrl}
                    onChange={(e) => { setCloneUrl(e.target.value); setCloneError(null); }}
                    placeholder="https://your-bucket.oss-cn-xxx.aliyuncs.com/voice.mp3"
                    className="h-10 rounded-xl text-sm font-mono"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    需要公网可访问的 URL，10-20秒清晰朗读音频
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-zinc-500 mb-1.5">voice_id</p>
                  <Input
                    value={cloneVoiceId}
                    onChange={(e) => { setCloneVoiceId(e.target.value); setCloneError(null); }}
                    placeholder="cosyvoice-v3-flash-myvoice-xxxxxxxx"
                    className="h-10 rounded-xl text-sm font-mono"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    从阿里云百炼控制台复制的 voice_id
                  </p>
                </div>
              )}

              {/* Error / Success messages */}
              {cloneError && (
                <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50/80 rounded-lg px-3 py-2">
                  <Icon name="error" size={14} className="shrink-0 mt-0.5" />
                  {cloneError}
                </div>
              )}
              {cloneSuccess && (
                <div className="flex items-start gap-2 text-xs text-green-600 bg-green-50/80 rounded-lg px-3 py-2">
                  <Icon name="check_circle" size={14} className="shrink-0 mt-0.5" />
                  {cloneSuccess}
                </div>
              )}

              {/* Clone button */}
              <Button
                onClick={handleClone}
                disabled={cloneLoading || (cloneMode === "url" ? !cloneUrl.trim() : !cloneVoiceId.trim())}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl h-10 text-sm shadow-sm"
              >
                {cloneLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Icon name="progress_activity" size={16} className="animate-spin" />
                    {cloneMode === "url" ? "正在复刻..." : "正在保存..."}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Icon name={cloneMode === "url" ? "record_voice_over" : "add_circle"} size={16} />
                    {cloneMode === "url" ? "开始复刻" : "添加音色"}
                  </span>
                )}
              </Button>

              {/* Custom voices list */}
              {customVoices.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 mb-2">已有自定义音色</p>
                  <div className="space-y-1.5">
                    {customVoices.map((cv) => (
                      <div
                        key={cv.voiceId}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                          settings.ttsVoice === cv.voiceId
                            ? "border-amber-300 bg-amber-50/50"
                            : "border-zinc-100 hover:border-zinc-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon name="mic" size={16} className={
                            settings.ttsVoice === cv.voiceId ? "text-amber-600" : "text-zinc-400"
                          } />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-700 truncate">{cv.name}</p>
                            <p className="text-[10px] text-zinc-400 font-mono truncate">{cv.voiceId}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {settings.ttsVoice === cv.voiceId && (
                            <span className="text-[10px] text-amber-600 font-medium mr-1">使用中</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteVoice(cv.voiceId)}
                            className="text-zinc-300 hover:text-red-500 transition-colors p-1"
                            title="删除"
                          >
                            <Icon name="delete" size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* === Section 4: Temperature === */}
          <div className="space-y-3">
            {sectionHeader(4, "创造性调节", true, "tune")}

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
