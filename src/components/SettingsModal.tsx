"use client";

import { Settings } from "@/lib/types";
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
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedKeyRef = useRef<string>("");

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
        body: JSON.stringify({ apiKey }),
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
          const preferred = data.models.find((m: ModelInfo) =>
            m.id.includes("2.5-flash") && !m.id.includes("lite")
          );
          onUpdate({ modelName: preferred?.id || data.models[0].id });
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
  }, [settings.modelName, onUpdate]);

  useEffect(() => {
    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
    }

    if (!settings.geminiApiKey || settings.geminiApiKey.length < 10) {
      setModels([]);
      setKeyValid(null);
      setModelsError(null);
      lastFetchedKeyRef.current = "";
      return;
    }

    fetchTimerRef.current = setTimeout(() => {
      fetchModels(settings.geminiApiKey);
    }, 800);

    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    };
  }, [settings.geminiApiKey, fetchModels]);

  useEffect(() => {
    if (open && settings.geminiApiKey && settings.geminiApiKey.length >= 10 && models.length === 0) {
      fetchModels(settings.geminiApiKey);
    }
  }, [open, settings.geminiApiKey, models.length, fetchModels]);

  const stepNumber = (n: number, active: boolean) => (
    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
      active ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-400"
    }`}>
      {n}
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Icon name="settings" size={18} className="text-white" />
            </div>
            模型设置
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 sm:px-6 sm:pb-6 space-y-5 mt-4">

          {/* Step 1: API Key */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              {stepNumber(1, true)}
              <span className="text-sm font-semibold text-stone-700">API Key 配置</span>
              {keyValid === true && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <Icon name="check_circle" size={13} />
                  已连接
                </span>
              )}
            </div>

            <div className="ml-8 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={settings.geminiApiKey}
                    onChange={(e) => onUpdate({ geminiApiKey: e.target.value })}
                    placeholder="AIzaSy..."
                    className={`font-mono text-sm pr-9 h-11 rounded-xl ${
                      keyValid === true
                        ? "border-green-300 focus-visible:ring-green-300"
                        : keyValid === false
                          ? "border-red-300 focus-visible:ring-red-300"
                          : "focus-visible:ring-amber-300"
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {modelsLoading && (
                      <Icon name="progress_activity" size={16} className="text-amber-500 animate-spin" />
                    )}
                    {!modelsLoading && keyValid === true && (
                      <Icon name="check_circle" size={16} className="text-green-500" />
                    )}
                    {!modelsLoading && keyValid === false && (
                      <Icon name="cancel" size={16} className="text-red-400" />
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKey(!showKey)}
                  className="shrink-0 h-11 w-11 rounded-xl"
                >
                  <Icon name={showKey ? "visibility_off" : "visibility"} size={20} />
                </Button>
              </div>

              {modelsError && (
                <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50/80 rounded-lg px-3 py-2">
                  <Icon name="error" size={14} className="shrink-0 mt-0.5" />
                  {modelsError}
                </div>
              )}
              {keyValid === true && (
                <p className="text-xs text-green-600">
                  已加载 {models.length} 个可用模型
                </p>
              )}
              {keyValid === null && !modelsLoading && (
                <p className="text-xs text-zinc-400">
                  从{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 hover:text-amber-700 underline underline-offset-2"
                  >
                    Google AI Studio
                  </a>{" "}
                  获取免费 API Key
                </p>
              )}
            </div>
          </div>

          {/* Step 2: Model Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              {stepNumber(2, keyValid === true)}
              <span className="text-sm font-semibold text-stone-700">选择模型</span>
              {settings.geminiApiKey && keyValid === true && (
                <button
                  className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-600 transition-colors"
                  disabled={modelsLoading}
                  onClick={() => {
                    lastFetchedKeyRef.current = "";
                    fetchModels(settings.geminiApiKey);
                  }}
                >
                  <Icon name="refresh" size={14} className={modelsLoading ? "animate-spin" : ""} />
                  刷新
                </button>
              )}
            </div>

            <div className="ml-8 space-y-2">
              {models.length > 0 ? (
                <>
                  <Select
                    value={settings.modelName}
                    onValueChange={(v) => onUpdate({ modelName: v })}
                  >
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
                  {settings.modelName && (
                    <p className="text-xs text-zinc-400">
                      当前: <span className="font-mono text-amber-700">{settings.modelName}</span>
                    </p>
                  )}
                </>
              ) : (
                <div className="border border-dashed border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-400 text-center">
                  {modelsLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Icon name="progress_activity" size={16} className="animate-spin text-amber-500" />
                      正在加载模型列表...
                    </span>
                  ) : settings.geminiApiKey ? (
                    "请输入有效的 API Key"
                  ) : (
                    "请先完成第 1 步"
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Temperature */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              {stepNumber(3, keyValid === true)}
              <span className="text-sm font-semibold text-stone-700">创造性调节</span>
              <span className="ml-auto text-sm font-mono font-semibold text-amber-700">
                {settings.temperature.toFixed(1)}
              </span>
            </div>

            <div className="ml-8 space-y-2">
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
