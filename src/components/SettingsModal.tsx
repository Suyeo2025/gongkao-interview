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
import { VoiceCloneDialog } from "./VoiceCloneDialog";
import { exportData, importData } from "@/lib/storage";
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

  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  const [voiceCloneOpen, setVoiceCloneOpen] = useState(false);

  // Data management
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentApiKey = settings.textProvider === "gemini" ? settings.geminiApiKey : settings.qwenApiKey;

  // ─── Fetch helpers ─────────────────────────────────────────────

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

  // ─── Effects ───────────────────────────────────────────────────

  useEffect(() => {
    if (settings.dashscopeApiKey && settings.dashscopeApiKey.length >= 10) {
      fetchTTSModels(settings.dashscopeApiKey);
    }
  }, [settings.dashscopeApiKey, fetchTTSModels]);

  useEffect(() => {
    if (settings.ttsModel.includes("v3.5")) {
      onUpdate({ ttsModel: "cosyvoice-v3-flash" });
      return;
    }
    fetchVoices(settings.ttsModel);
  }, [settings.ttsModel, fetchVoices, onUpdate]);

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

  // ─── Voice selection ───────────────────────────────────────────

  const handleSelectVoice = useCallback((voiceId: string) => {
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

  // ─── Data management ──────────────────────────────────────────

  const handleExport = useCallback(() => {
    const json = exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gongkao-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ok = importData(reader.result as string);
        if (ok) {
          window.location.reload();
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    []
  );

  // ─── Reusable UI helpers ──────────────────────────────────────

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-5 pt-5 pb-0 sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <Icon name="settings" size={18} className="text-white" />
              </div>
              设置
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

            {/* === Section 2: TTS (simplified, no voice cloning) === */}
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

                {/* Voice selector — custom voices first */}
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
                      {/* Custom voices first — visually prominent */}
                      {customVoices.length > 0 && (
                        <>
                          {customVoices.map((cv) => (
                            <SelectItem key={cv.voiceId} value={cv.voiceId}>
                              <div className="flex items-center gap-2">
                                <Icon name="mic" size={14} className="text-amber-600" fill />
                                <span className="text-sm font-medium">{cv.name}</span>
                                <span className="text-[10px] px-1 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">自定义</span>
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

                {/* Voice clone entry */}
                <button
                  type="button"
                  onClick={() => setVoiceCloneOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 transition-colors"
                >
                  <Icon name="mic" size={14} />
                  管理自定义音色
                  <Icon name="chevron_right" size={14} />
                </button>
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

            {/* === Section 4: Data Management === */}
            <div className="space-y-3">
              {sectionHeader(4, "数据管理", true, "folder_open")}

              <div className="ml-8 space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="flex-1 gap-1.5 text-xs rounded-xl h-10"
                  >
                    <Icon name="download" size={16} />
                    导出数据
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImport}
                    className="flex-1 gap-1.5 text-xs rounded-xl h-10"
                  >
                    <Icon name="upload" size={16} />
                    导入数据
                  </Button>
                </div>
                <p className="text-[10px] text-zinc-400">
                  导出为 JSON 文件备份，含全部题目、答案、批注和版本历史
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileChange}
                />
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

      {/* Voice Clone Dialog — independent */}
      <VoiceCloneDialog
        open={voiceCloneOpen}
        onOpenChange={setVoiceCloneOpen}
        settings={settings}
        onUpdate={onUpdate}
        customVoices={customVoices}
        onRefreshVoices={fetchCustomVoices}
      />
    </>
  );
}
