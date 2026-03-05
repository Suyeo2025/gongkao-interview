"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/Icon";
import { BankQuestion, QuestionCategory, Settings } from "@/lib/types";

interface AddQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (content: string, category: QuestionCategory | null) => BankQuestion;
  onUpdateQuestion: (id: string, partial: Partial<BankQuestion>) => void;
  settings: Settings;
}

async function classifyQuestion(content: string, settings: Settings): Promise<QuestionCategory | null> {
  try {
    const apiKey = settings.textProvider === "qwen" ? settings.qwenApiKey : settings.geminiApiKey;
    if (!apiKey) return null;
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: content,
        apiKey,
        provider: settings.textProvider,
        modelName: settings.modelName,
      }),
    });
    const data = await res.json();
    return data.category || null;
  } catch {
    return null;
  }
}

export function AddQuestionDialog({ open, onOpenChange, onAdd, onUpdateQuestion, settings }: AddQuestionDialogProps) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"single" | "batch">("single");

  const handleSubmit = () => {
    if (mode === "batch") {
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      for (const line of lines) {
        const q = onAdd(line, null);
        // Fire-and-forget: AI auto-classify
        classifyQuestion(line, settings).then((cat) => {
          if (cat) onUpdateQuestion(q.id, { category: cat });
        });
      }
    } else {
      if (!text.trim()) return;
      const q = onAdd(text.trim(), null);
      classifyQuestion(text.trim(), settings).then((cat) => {
        if (cat) onUpdateQuestion(q.id, { category: cat });
      });
    }
    setText("");
    onOpenChange(false);
  };

  const lineCount = mode === "batch" ? text.split("\n").filter((l) => l.trim()).length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
              <Icon name="add_circle" size={18} className="text-white" />
            </div>
            添加题目
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                mode === "single" ? "bg-white text-zinc-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              单题添加
            </button>
            <button
              type="button"
              onClick={() => setMode("batch")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                mode === "batch" ? "bg-white text-zinc-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              批量粘贴
            </button>
          </div>

          {/* AI auto-classify hint */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 px-1">
            <Icon name="auto_awesome" size={14} className="text-zinc-500" />
            <span>添加后 AI 将自动识别题型分类</span>
          </div>

          {/* Text input */}
          <div>
            <p className="text-xs text-zinc-500 mb-1.5">
              {mode === "single" ? "题目内容" : "批量粘贴（每行一题）"}
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === "single" ? "输入面试题目..." : "每行一道题目，粘贴后一键添加..."}
              className="min-h-[120px] rounded-xl text-sm resize-none"
              autoFocus
            />
            {mode === "batch" && lineCount > 0 && (
              <p className="text-[11px] text-zinc-600 mt-1">
                检测到 {lineCount} 道题目
              </p>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-10 text-sm shadow-sm"
          >
            <Icon name="add" size={16} className="mr-1.5" />
            {mode === "batch" && lineCount > 1 ? `添加 ${lineCount} 道题` : "添加题目"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
