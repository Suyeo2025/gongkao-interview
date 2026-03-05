"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { ExamSession } from "@/lib/types";
import { getExamSessions, saveExamSessions } from "@/lib/storage";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

interface ExamSessionListProps {
  refreshKey?: number;
  onViewSession: (session: ExamSession) => void;
  onStartExam?: () => void;
}

export function ExamSessionList({ refreshKey, onViewSession, onStartExam }: ExamSessionListProps) {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setSessions(getExamSessions());
  }, [refreshKey]);

  const handleDelete = (id: string) => {
    const next = sessions.filter((s) => s.id !== id);
    saveExamSessions(next);
    setSessions(next);
    setConfirmDeleteId(null);
    // Also delete from server
    fetch("/api/data/exam-sessions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, _delete: true }),
    }).catch(() => {});
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-400">
        <Icon name="history" size={48} className="mx-auto mb-3 text-zinc-300" />
        <p className="text-sm mb-1">暂无模考记录</p>
        <p className="text-xs text-zinc-300 mb-4">完成模考后记录会出现在这里</p>
        {onStartExam && (
          <button
            type="button"
            onClick={onStartExam}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors"
          >
            <Icon name="play_arrow" size={16} />
            开始考试
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="group rounded-xl border border-zinc-200/60 bg-white px-4 py-3 hover:border-zinc-400 transition-all cursor-pointer active:scale-[0.99] border-l-2 border-l-zinc-300"
          onClick={() => onViewSession(session)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-zinc-800">{session.paperName}</h4>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  session.mode === "practice"
                    ? "bg-zinc-100 text-zinc-600"
                    : "bg-zinc-200 text-zinc-700"
                }`}>
                  {session.mode === "practice" ? "练习" : "模考"}
                </span>
                {session.totalScore != null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    session.totalScore >= 90
                      ? "bg-emerald-100 text-emerald-700"
                      : session.totalScore >= 70
                        ? "bg-zinc-100 text-zinc-700"
                        : "bg-red-100 text-red-700"
                  }`}>
                    {session.totalScore}分
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {session.answers.length} 题 ·{" "}
                {session.status === "completed" ? "已完成" : "进行中"} ·{" "}
                {formatDate(session.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(session.id);
                }}
                className="h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity rounded-lg"
              >
                <Icon name="delete" size={16} />
              </button>
              <Icon name="chevron_right" size={18} className="text-zinc-300" />
            </div>
          </div>
        </div>
      ))}

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl border border-zinc-200/60" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-zinc-800 mb-1.5">确认删除？</h3>
            <p className="text-xs text-zinc-500 mb-4">
              删除后无法恢复，考试记录和评估结果将永久丢失。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
