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
  onViewSession: (session: ExamSession) => void;
}

export function ExamSessionList({ onViewSession }: ExamSessionListProps) {
  const [sessions, setSessions] = useState<ExamSession[]>([]);

  useEffect(() => {
    setSessions(getExamSessions());
  }, []);

  const handleDelete = (id: string) => {
    const next = sessions.filter((s) => s.id !== id);
    saveExamSessions(next);
    setSessions(next);
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-400">
        <Icon name="history" size={48} className="mx-auto mb-3 text-amber-300" />
        <p className="text-sm mb-1">暂无模考记录</p>
        <p className="text-xs text-zinc-300">完成模考后记录会出现在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="group rounded-xl border border-zinc-200/60 bg-white px-4 py-3 hover:border-amber-300 transition-all cursor-pointer active:scale-[0.99] border-l-2 border-l-amber-300"
          onClick={() => onViewSession(session)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-zinc-800">{session.paperName}</h4>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  session.mode === "practice"
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-blue-100 text-blue-600"
                }`}>
                  {session.mode === "practice" ? "练习" : "模考"}
                </span>
                {session.totalScore != null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    session.totalScore >= 90
                      ? "bg-emerald-100 text-emerald-700"
                      : session.totalScore >= 70
                        ? "bg-amber-100 text-amber-700"
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
                  handleDelete(session.id);
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
    </div>
  );
}
