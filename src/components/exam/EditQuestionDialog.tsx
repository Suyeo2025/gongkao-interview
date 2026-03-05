"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/Icon";
import { BankQuestion, QuestionCategory, ALL_CATEGORIES, CATEGORY_COLORS } from "@/lib/types";

interface EditQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: BankQuestion;
  onSave: (originalId: string, content: string, category: QuestionCategory | null) => void;
}

export function EditQuestionDialog({ open, onOpenChange, question, onSave }: EditQuestionDialogProps) {
  const [content, setContent] = useState(question.content);
  const [category, setCategory] = useState<QuestionCategory | null>(question.category);

  // Reset when question changes
  const [lastId, setLastId] = useState(question.id);
  if (question.id !== lastId) {
    setContent(question.content);
    setCategory(question.category);
    setLastId(question.id);
  }

  const handleSave = () => {
    if (!content.trim()) return;
    onSave(question.id, content.trim(), category);
    onOpenChange(false);
  };

  const hasChanges = content.trim() !== question.content || category !== question.category;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
              <Icon name="edit_note" size={18} className="text-white" />
            </div>
            编辑题目
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-50 rounded-lg px-3 py-2">
            <Icon name="info" size={14} className="shrink-0" />
            编辑将创建新题目，原题目保持不变
          </div>

          <div>
            <p className="text-xs text-zinc-500 mb-1.5">题目内容</p>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px] rounded-xl text-sm resize-none"
              autoFocus
            />
          </div>

          <div>
            <p className="text-xs text-zinc-500 mb-1.5">题型分类</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(category === cat ? null : cat)}
                  className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    category === cat
                      ? CATEGORY_COLORS[cat]
                      : "bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={!content.trim() || !hasChanges}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-10 text-sm shadow-sm"
          >
            <Icon name="add_circle" size={16} className="mr-1.5" />
            创建新题目
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
