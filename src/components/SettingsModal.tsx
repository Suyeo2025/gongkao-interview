"use client";

import { Settings, DEFAULT_SETTINGS } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Eye, EyeOff, RotateCcw, Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
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

      // Auto-select first model if current selection is not in the list
      if (data.models?.length > 0) {
        const currentValid = data.models.some(
          (m: ModelInfo) => m.id === settings.modelName
        );
        if (!currentValid) {
          // Pick gemini-2.5-flash if available, otherwise first
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

  // Debounced fetch when API key changes
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

  // Fetch models when dialog opens if key exists
  useEffect(() => {
    if (open && settings.geminiApiKey && settings.geminiApiKey.length >= 10 && models.length === 0) {
      fetchModels(settings.geminiApiKey);
    }
  }, [open, settings.geminiApiKey, models.length, fetchModels]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">模型设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-1 sm:py-2">
          {/* API Key */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Gemini API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={settings.geminiApiKey}
                  onChange={(e) => onUpdate({ geminiApiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className={`font-mono text-sm pr-8 ${
                    keyValid === true
                      ? "border-green-400 focus-visible:ring-green-400"
                      : keyValid === false
                        ? "border-red-400 focus-visible:ring-red-400"
                        : ""
                  }`}
                />
                {/* Key validation indicator */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {modelsLoading && (
                    <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />
                  )}
                  {!modelsLoading && keyValid === true && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {!modelsLoading && keyValid === false && (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKey(!showKey)}
                className="shrink-0 h-10 w-10"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {modelsError && (
              <p className="text-xs text-red-500">{modelsError}</p>
            )}
            {keyValid === true && (
              <p className="text-xs text-green-600">
                Key 验证通过，已加载 {models.length} 个可用模型
              </p>
            )}
            {keyValid === null && (
              <p className="text-xs text-zinc-500">
                从{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 hover:underline"
                >
                  Google AI Studio
                </a>{" "}
                获取 API Key，输入后自动拉取可用模型
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">模型选择</Label>
              {settings.geminiApiKey && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1 text-zinc-500"
                  disabled={modelsLoading}
                  onClick={() => {
                    lastFetchedKeyRef.current = "";
                    fetchModels(settings.geminiApiKey);
                  }}
                >
                  <RefreshCw className={`h-4 w-4 ${modelsLoading ? "animate-spin" : ""}`} />
                  刷新
                </Button>
              )}
            </div>

            {models.length > 0 ? (
              <Select
                value={settings.modelName}
                onValueChange={(v) => onUpdate({ modelName: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex flex-col">
                        <span className="text-sm">{m.id}</span>
                        {m.description && (
                          <span className="text-[10px] text-zinc-400 truncate max-w-[350px]">
                            {m.description.slice(0, 80)}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="border rounded-md px-3 py-2 text-sm text-zinc-400">
                {modelsLoading
                  ? "正在加载模型列表..."
                  : settings.geminiApiKey
                    ? "请输入有效的 API Key 以加载模型"
                    : "请先输入 API Key"}
              </div>
            )}

            {settings.modelName && models.length > 0 && (
              <p className="text-xs text-zinc-500">
                当前: <span className="font-mono text-violet-600">{settings.modelName}</span>
              </p>
            )}
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Temperature</Label>
              <span className="text-xs font-mono text-zinc-500">
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
            <p className="text-xs text-zinc-500">
              越低越稳定严谨，越高越发散创意。面试建议 0.5-0.8
            </p>
          </div>

          {/* Reset */}
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              onClick={onReset}
              className="gap-1.5 text-sm h-10"
            >
              <RotateCcw className="h-4 w-4" />
              恢复默认参数
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
