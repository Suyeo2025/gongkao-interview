"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/Icon";
import { Textarea } from "@/components/ui/textarea";
import { QuestionCategory, CATEGORY_COLORS, ALL_CATEGORIES, Settings } from "@/lib/types";

interface ParsedQuestion {
  content: string;
  category: string | null;
  selected: boolean;
  editing?: boolean;
}

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onAddBatch: (items: Array<{ content: string; category?: QuestionCategory | null; sourceFile?: string }>) => void;
}

export function FileUploadDialog({ open, onOpenChange, settings, onAddBatch }: FileUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
      setParsed([]);
    }
  };

  const activeApiKey = settings.textProvider === "qwen"
    ? (settings.qwenApiKey || settings.dashscopeApiKey)
    : settings.geminiApiKey;

  const handleParse = async () => {
    if (!file || !activeApiKey) return;
    setLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const res = await fetch("/api/parse-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64,
          mimeType: file.type || "application/pdf",
          apiKey: activeApiKey,
          provider: settings.textProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setParsed(
        data.questions.map((q: { content: string; category?: string | null }) => ({
          ...q,
          selected: true,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSelected = () => {
    const selected = parsed.filter((q) => q.selected);
    if (selected.length === 0) return;
    onAddBatch(
      selected.map((q) => ({
        content: q.content,
        category: q.category as QuestionCategory | null,
        sourceFile: file?.name,
      }))
    );
    setParsed([]);
    setFile(null);
    onOpenChange(false);
  };

  const toggleAll = () => {
    const allSelected = parsed.every((q) => q.selected);
    setParsed(parsed.map((q) => ({ ...q, selected: !allSelected })));
  };

  const selectedCount = parsed.filter((q) => q.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
              <Icon name="upload_file" size={18} className="text-white" />
            </div>
            上传文件解析题目
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* File selection */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-200 rounded-xl p-6 text-center cursor-pointer hover:border-zinc-400 hover:bg-zinc-50/30 transition-colors"
          >
            <Icon name={file ? "description" : "cloud_upload"} size={32} className="mx-auto mb-2 text-zinc-300" />
            {file ? (
              <div>
                <p className="text-sm font-medium text-zinc-700">{file.name}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {(file.size / 1024).toFixed(0)} KB · 点击更换
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-zinc-500">点击选择 PDF 或图片文件</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">支持 PDF、JPG、PNG</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Parse button */}
          {file && parsed.length === 0 && (
            <Button
              onClick={handleParse}
              disabled={loading || !activeApiKey}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-10 text-sm shadow-sm"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Icon name="progress_activity" size={16} className="animate-spin" />
                  AI 正在解析...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Icon name="auto_awesome" size={16} />
                  AI 解析题目
                </span>
              )}
            </Button>
          )}

          {!activeApiKey && (
            <p className="text-xs text-zinc-600 text-center">
              请先在设置中配置 {settings.textProvider === "qwen" ? "DashScope" : "Gemini"} API Key
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50/80 rounded-lg px-3 py-2">
              <Icon name="error" size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Parsed results */}
          {parsed.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-600">
                  解析到 {parsed.length} 道题目
                </p>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[11px] text-zinc-600 hover:text-zinc-700"
                >
                  {parsed.every((q) => q.selected) ? "取消全选" : "全选"}
                </button>
              </div>

              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {parsed.map((q, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border px-3 py-2 transition-colors ${
                      q.selected ? "border-zinc-200 bg-zinc-50/40" : "border-zinc-100 opacity-50"
                    }`}
                  >
                    {q.editing ? (
                      /* Editing mode */
                      <div className="space-y-2">
                        <Textarea
                          value={q.content}
                          onChange={(e) => {
                            const next = [...parsed];
                            next[i] = { ...next[i], content: e.target.value };
                            setParsed(next);
                          }}
                          className="text-xs min-h-[60px] resize-none focus-visible:ring-zinc-200"
                          autoFocus
                        />
                        <div className="flex items-center gap-1 flex-wrap">
                          {ALL_CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                const next = [...parsed];
                                next[i] = { ...next[i], category: q.category === cat ? null : cat };
                                setParsed(next);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                                q.category === cat
                                  ? CATEGORY_COLORS[cat]
                                  : "bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100"
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...parsed];
                              next[i] = { ...next[i], editing: false };
                              setParsed(next);
                            }}
                            className="p-1 rounded-lg text-zinc-600 hover:bg-zinc-50"
                            title="完成编辑"
                          >
                            <Icon name="check" size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <div
                        className="flex items-start gap-2 cursor-pointer"
                        onClick={() => {
                          const next = [...parsed];
                          next[i] = { ...next[i], selected: !next[i].selected };
                          setParsed(next);
                        }}
                      >
                        <Icon
                          name={q.selected ? "check_circle" : "radio_button_unchecked"}
                          size={16}
                          fill={q.selected}
                          className={`shrink-0 mt-0.5 ${q.selected ? "text-zinc-500" : "text-zinc-300"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-700 leading-relaxed">{q.content}</p>
                          {q.category && (
                            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              CATEGORY_COLORS[q.category as keyof typeof CATEGORY_COLORS] || "bg-zinc-50 text-zinc-500 border-zinc-200"
                            }`}>
                              {q.category}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = [...parsed];
                            next[i] = { ...next[i], editing: true };
                            setParsed(next);
                          }}
                          className="p-1 rounded-lg text-zinc-300 hover:text-zinc-600 hover:bg-zinc-50 shrink-0 transition-all"
                          title="编辑"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                onClick={handleAddSelected}
                disabled={selectedCount === 0}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-10 text-sm shadow-sm"
              >
                <Icon name="add" size={16} className="mr-1.5" />
                添加 {selectedCount} 道题到题库
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
