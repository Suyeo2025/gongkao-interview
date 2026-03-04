"use client";

import { useState, useRef, useEffect } from "react";
import { SectionAnnotation } from "@/lib/types";
import { Icon } from "./Icon";

interface SectionAnnotationPanelProps {
  annotations: SectionAnnotation[];
  onAdd: (content: string) => void;
  onDelete: (annotationId: string) => void;
  onUpdate: (annotationId: string, content: string) => void;
}

export function SectionAnnotationPanel({
  annotations,
  onAdd,
  onDelete,
  onUpdate,
}: SectionAnnotationPanelProps) {
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAdd = () => {
    if (!newText.trim()) return;
    onAdd(newText.trim());
    setNewText("");
    inputRef.current?.focus();
  };

  const startEdit = (ann: SectionAnnotation) => {
    setEditingId(ann.id);
    setEditText(ann.content);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editText.trim()) return;
    onUpdate(editingId, editText.trim());
    setEditingId(null);
    setEditText("");
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    } catch {
      return "";
    }
  };

  return (
    <div className="mt-3 rounded-xl bg-amber-50/60 border border-amber-100/60 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <Icon name="sticky_note_2" size={14} />
        <span>我的笔记</span>
        {annotations.length > 0 && (
          <span className="text-amber-500 font-normal">({annotations.length})</span>
        )}
      </div>

      {/* Existing annotations */}
      {annotations.length > 0 && (
        <div className="space-y-1.5">
          {annotations.map((ann) => (
            <div
              key={ann.id}
              className="group rounded-lg bg-white/80 border border-amber-100/40 px-2.5 py-2 text-sm"
            >
              {editingId === ann.id ? (
                <div className="space-y-1.5">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-amber-300"
                    rows={2}
                    autoFocus
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        handleSaveEdit();
                      }
                      if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                  />
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-2 py-0.5 rounded text-[11px] text-zinc-500 hover:bg-zinc-100"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="px-2 py-0.5 rounded text-[11px] text-white bg-amber-500 hover:bg-amber-600"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">
                    {ann.content}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-zinc-400">{formatTime(ann.updatedAt || ann.createdAt)}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => startEdit(ann)}
                        className="p-0.5 rounded text-zinc-400 hover:text-amber-600"
                        title="编辑"
                      >
                        <Icon name="edit" size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(ann.id)}
                        className="p-0.5 rounded text-zinc-400 hover:text-red-500"
                        title="删除"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new annotation */}
      <div className="flex items-stretch gap-1.5">
        <textarea
          ref={inputRef}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="写下你的笔记或批注..."
          className="flex-1 rounded-lg border border-amber-200/60 bg-white px-2.5 py-1.5 text-xs text-zinc-700 resize-none focus:outline-none focus:ring-1 focus:ring-amber-300 placeholder:text-zinc-400"
          rows={2}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newText.trim()}
          className="flex items-center justify-center px-2.5 rounded-lg text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Icon name="add" size={14} />
        </button>
      </div>
    </div>
  );
}
