"use client";

import { useState, useCallback } from "react";
import { Settings, type CustomVoice } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "./Icon";

interface VoiceCloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => void;
  customVoices: CustomVoice[];
  onRefreshVoices: () => Promise<void>;
}

export function VoiceCloneDialog({
  open,
  onOpenChange,
  settings,
  onUpdate,
  customVoices,
  onRefreshVoices,
}: VoiceCloneDialogProps) {
  const [cloneMode, setCloneMode] = useState<"url" | "id">("url");
  const [cloneName, setCloneName] = useState("我的音色");
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneVoiceId, setCloneVoiceId] = useState("");
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

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

        await onRefreshVoices();
        setCloneSuccess(`音色"${cloneName.trim()}"添加成功！`);
        onUpdate({
          ttsVoice: cloneVoiceId.trim(),
          customVoiceTargetModel: settings.ttsModel,
          customVoiceName: cloneName.trim() + " (自定义)",
        });
      } else {
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
        await onRefreshVoices();
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
  }, [cloneMode, cloneVoiceId, cloneUrl, cloneName, settings.dashscopeApiKey, settings.ttsModel, onRefreshVoices, onUpdate]);

  const handleDeleteVoice = useCallback(async (voiceId: string) => {
    try {
      await fetch(`/api/voice-clone/list?voiceId=${encodeURIComponent(voiceId)}`, {
        method: "DELETE",
      });
      await onRefreshVoices();
      if (settings.ttsVoice === voiceId) {
        onUpdate({
          ttsVoice: "longanxuan_v3",
          customVoiceTargetModel: "",
          customVoiceName: "",
        });
      }
    } catch { /* ignore */ }
  }, [settings.ttsVoice, onUpdate, onRefreshVoices]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center">
              <Icon name="mic" size={18} className="text-white" />
            </div>
            声音复刻
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
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
            className="w-full bg-gradient-to-r from-zinc-700 to-zinc-800 hover:from-zinc-800 hover:to-zinc-900 text-white rounded-xl h-10 text-sm shadow-sm"
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
      </DialogContent>
    </Dialog>
  );
}
