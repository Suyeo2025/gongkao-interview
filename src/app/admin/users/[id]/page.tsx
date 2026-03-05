"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/Icon";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type {
  Settings,
  QAPair,
  BankQuestion,
  ExamPaper,
  ExamSession,
  ExamEvaluation,
  QuestionCategory,
} from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────

interface UserDetail {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  _count: {
    history: number;
    questions: number;
    examPapers: number;
    examSessions: number;
    mentorEvals: number;
  };
}

interface OverviewData {
  settings: Partial<Settings>;
  counts: {
    history: number;
    questions: number;
    examPapers: number;
    examSessions: number;
    mentorEvals: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function maskKey(key: string) {
  if (!key || key.length < 8) return key ? "••••" : "未设置";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}

function fmtDate(d: string | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ─── Main ───────────────────────────────────────────────────────

export default function UserDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("settings");

  // Fetch user info + overview
  useEffect(() => {
    (async () => {
      try {
        const [uRes, oRes] = await Promise.all([
          fetch(`/api/admin/users/${id}`),
          fetch(`/api/admin/users/${id}/data?type=all`),
        ]);
        if (!uRes.ok) {
          router.push("/admin");
          return;
        }
        setUser(await uRes.json());
        setOverview(await oRes.json());
      } catch {
        router.push("/admin");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  // Password reset
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [resetPwd, setResetPwd] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pwd = "";
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  const handleResetPassword = async () => {
    if (!resetPwd.trim()) return;
    setResetLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPwd }),
      });
      if (res.ok) setResetDone(true);
    } catch { /* ignore */ }
    finally { setResetLoading(false); }
  };

  const openResetDialog = () => {
    setResetPwd(generatePassword());
    setResetDone(false);
    setShowResetPwd(true);
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    if (!confirm(`确定删除用户 "${user.username}"？所有数据将被清除。`)) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    router.push("/admin");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="progress_activity" size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-50/50">
      {/* Header */}
      <header className="h-12 sm:h-14 bg-white/80 backdrop-blur-xl px-3 sm:px-6 flex items-center justify-between shrink-0 border-b border-zinc-100">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-500" onClick={() => router.push("/admin")}>
            <Icon name="arrow_back" size={20} />
          </Button>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-zinc-800 flex items-center justify-center shadow-sm">
            <Icon name="person" size={16} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-semibold text-zinc-800">{user.username}</h1>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                user.role === "admin"
                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-zinc-100 text-zinc-500 border border-zinc-200"
              }`}>
                {user.role === "admin" ? "管理员" : "成员"}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 hidden sm:block">创建于 {fmtDate(user.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-amber-600" onClick={openResetDialog} title="重置密码">
            <Icon name="key" size={18} />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-red-500" onClick={handleDeleteUser} title="删除用户">
            <Icon name="delete" size={18} />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full overflow-x-auto" variant="line">
            <TabsTrigger value="settings" className="gap-1 text-xs">
              <Icon name="settings" size={14} /> 设置
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1 text-xs">
              <Icon name="history" size={14} /> 历史
              {overview && <span className="text-[10px] text-zinc-400 ml-0.5">{overview.counts.history}</span>}
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-1 text-xs">
              <Icon name="quiz" size={14} /> 题库
              {overview && <span className="text-[10px] text-zinc-400 ml-0.5">{overview.counts.questions}</span>}
            </TabsTrigger>
            <TabsTrigger value="papers" className="gap-1 text-xs">
              <Icon name="description" size={14} /> 试卷
              {overview && <span className="text-[10px] text-zinc-400 ml-0.5">{overview.counts.examPapers}</span>}
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-1 text-xs">
              <Icon name="assignment" size={14} /> 考试
              {overview && <span className="text-[10px] text-zinc-400 ml-0.5">{overview.counts.examSessions}</span>}
            </TabsTrigger>
            <TabsTrigger value="evals" className="gap-1 text-xs">
              <Icon name="rate_review" size={14} /> 评价
              {overview && <span className="text-[10px] text-zinc-400 ml-0.5">{overview.counts.mentorEvals}</span>}
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="settings">
              <SettingsTab userId={id} initial={overview?.settings || {}} />
            </TabsContent>
            <TabsContent value="history">
              <DataListTab userId={id} type="history" />
            </TabsContent>
            <TabsContent value="questions">
              <DataListTab userId={id} type="questions" />
            </TabsContent>
            <TabsContent value="papers">
              <DataListTab userId={id} type="exam-papers" />
            </TabsContent>
            <TabsContent value="sessions">
              <DataListTab userId={id} type="exam-sessions" />
            </TabsContent>
            <TabsContent value="evals">
              <DataListTab userId={id} type="mentor-evals" />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Password reset dialog */}
      {showResetPwd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setShowResetPwd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">
                重置密码 · {user?.username}
              </h3>
              <button type="button" onClick={() => setShowResetPwd(false)} className="text-zinc-400 hover:text-zinc-600">
                <Icon name="close" size={18} />
              </button>
            </div>

            {!resetDone ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">新密码</label>
                  <div className="flex gap-2">
                    <Input
                      value={resetPwd}
                      onChange={(e) => setResetPwd(e.target.value)}
                      placeholder="输入或生成密码"
                      className="h-10 rounded-xl text-sm font-mono flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl shrink-0"
                      onClick={() => setResetPwd(generatePassword())}
                      title="生成随机密码"
                    >
                      <Icon name="casino" size={18} />
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handleResetPassword}
                  disabled={!resetPwd.trim() || resetLoading}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl h-10 text-sm"
                >
                  {resetLoading ? "重置中…" : "确认重置"}
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                  <Icon name="check_circle" size={18} className="text-emerald-600 shrink-0" />
                  <span className="text-xs text-emerald-700">密码已重置成功</span>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500">新密码（请复制后告知用户）</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 font-mono text-sm text-zinc-800 select-all">
                      {resetPwd}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl shrink-0"
                      onClick={() => navigator.clipboard.writeText(resetPwd)}
                      title="复制密码"
                    >
                      <Icon name="content_copy" size={18} />
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowResetPwd(false)}
                  className="w-full rounded-xl h-10 text-sm"
                >
                  关闭
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ───────────────────────────────────────────────

function SettingsTab({ userId, initial }: { userId: string; initial: Partial<Settings> }) {
  const [settings, setSettings] = useState<Partial<Settings>>(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revealKeys, setRevealKeys] = useState<Set<string>>(new Set());

  // Refetch settings on mount
  useEffect(() => {
    fetch(`/api/admin/users/${userId}/data?type=settings`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data && Object.keys(data).length > 0) setSettings(data); })
      .catch(() => {});
  }, [userId]);

  const toggleReveal = (key: string) => {
    setRevealKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/users/${userId}/data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "settings", data: settings }),
      });
      setEditing(false);
    } catch {
      alert("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof Settings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const sections: {
    title: string;
    icon: string;
    fields: { key: keyof Settings; label: string; type?: "key" | "text" | "number" }[];
  }[] = [
    {
      title: "文本生成",
      icon: "text_fields",
      fields: [
        { key: "textProvider", label: "Provider", type: "text" },
        { key: "geminiApiKey", label: "Gemini API Key", type: "key" },
        { key: "qwenApiKey", label: "Qwen API Key", type: "key" },
        { key: "modelName", label: "模型", type: "text" },
        { key: "temperature", label: "Temperature", type: "number" },
      ],
    },
    {
      title: "TTS 音色",
      icon: "record_voice_over",
      fields: [
        { key: "dashscopeApiKey", label: "DashScope API Key", type: "key" },
        { key: "ttsModel", label: "TTS 模型", type: "text" },
        { key: "ttsVoice", label: "音色 ID", type: "text" },
        { key: "customVoiceName", label: "自定义音色名称", type: "text" },
        { key: "ttsRate", label: "语速", type: "number" },
        { key: "ttsInstruct", label: "指令", type: "text" },
      ],
    },
    {
      title: "导师音色",
      icon: "school",
      fields: [
        { key: "mentorVoice", label: "导师音色 ID", type: "text" },
        { key: "mentorVoiceName", label: "导师音色名称", type: "text" },
        { key: "mentorRate", label: "语速", type: "number" },
        { key: "mentorInstruct", label: "指令", type: "text" },
      ],
    },
    {
      title: "考试默认值",
      icon: "timer",
      fields: [
        { key: "defaultTimePerQuestion", label: "每题时长(秒)", type: "number" },
        { key: "defaultAdvanceMode", label: "推进方式", type: "text" },
        { key: "defaultTotalExamTime", label: "总时长(秒)", type: "number" },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {editing ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-8 rounded-lg" onClick={() => { setEditing(false); setSettings(initial); }}>
              取消
            </Button>
            <Button size="sm" className="text-xs h-8 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white" onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-xs h-8 rounded-lg gap-1" onClick={() => setEditing(true)}>
            <Icon name="edit" size={14} /> 编辑
          </Button>
        )}
      </div>

      {sections.map((section) => (
        <div key={section.title} className="bg-white rounded-xl border border-zinc-200/60 overflow-hidden">
          <div className="px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-100 flex items-center gap-2">
            <Icon name={section.icon} size={16} className="text-amber-600" />
            <span className="text-xs font-semibold text-zinc-700">{section.title}</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {section.fields.map((field) => {
              const val = settings[field.key];
              const strVal = val !== undefined && val !== null ? String(val) : "";
              const isKey = field.type === "key";

              return (
                <div key={field.key} className="px-4 py-2.5 flex items-center justify-between gap-4">
                  <span className="text-xs text-zinc-500 shrink-0 w-32">{field.label}</span>
                  {editing ? (
                    <Input
                      value={strVal}
                      onChange={(e) => update(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)}
                      className="h-8 text-xs rounded-lg flex-1 max-w-[280px]"
                      type={field.type === "number" ? "number" : "text"}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-800 font-mono">
                        {isKey ? (revealKeys.has(field.key) ? strVal || "未设置" : maskKey(strVal)) : (strVal || "未设置")}
                      </span>
                      {isKey && strVal && (
                        <button type="button" onClick={() => toggleReveal(field.key)} className="text-zinc-300 hover:text-zinc-500">
                          <Icon name={revealKeys.has(field.key) ? "visibility_off" : "visibility"} size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Generic Data List Tab ──────────────────────────────────────

type DataType = "history" | "questions" | "exam-papers" | "exam-sessions" | "mentor-evals";

function DataListTab({ userId, type }: { userId: string; type: DataType }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/data?type=${type}`);
      const json = await res.json();
      if (Array.isArray(json)) setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (itemId: string) => {
    if (!confirm("确定删除？")) return;
    await fetch(`/api/admin/users/${userId}/data`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id: itemId }),
    });
    setData((prev) => prev?.filter((d) => (d._id || d.id) !== itemId) || null);
  };

  const toggleExpand = (itemId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Icon name="progress_activity" size={24} className="animate-spin text-zinc-400 mx-auto mb-2" />
        <p className="text-xs text-zinc-400">加载中...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <Icon name="inbox" size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-xs">暂无数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-zinc-400">共 {data.length} 条记录</p>
        <button
          type="button"
          onClick={() => fetchData()}
          className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-amber-600 transition-colors"
        >
          <Icon name="refresh" size={14} />
          刷新
        </button>
      </div>
      {data.map((item, idx) => {
        const itemId = item._id || item.id || String(idx);
        const isExpanded = expanded.has(itemId);

        return (
          <div key={itemId} className="bg-white rounded-xl border border-zinc-200/60 overflow-hidden">
            <div
              className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-zinc-50/50 transition-colors"
              onClick={() => toggleExpand(itemId)}
            >
              <div className="flex-1 min-w-0">
                <ItemSummary type={type} item={item} />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(itemId); }}
                  className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="删除"
                >
                  <Icon name="delete" size={15} />
                </button>
                <Icon name={isExpanded ? "expand_less" : "expand_more"} size={18} className="text-zinc-300" />
              </div>
            </div>
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-zinc-100">
                <ItemDetail type={type} item={item} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Item Summary (collapsed view) ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ItemSummary({ type, item }: { type: DataType; item: any }) {
  switch (type) {
    case "history": {
      const pair = item as QAPair & { _createdAt?: string };
      return (
        <div>
          <p className="text-sm text-zinc-800 line-clamp-1">{pair.question?.content || "无内容"}</p>
          <div className="flex items-center gap-2 mt-1">
            {pair.answer?.metadata?.category && (
              <CategoryBadge category={pair.answer.metadata.category} />
            )}
            <span className="text-[10px] text-zinc-400">{fmtDate(pair.answer?.createdAt || pair._createdAt)}</span>
          </div>
        </div>
      );
    }
    case "questions": {
      const q = item as BankQuestion;
      return (
        <div>
          <p className="text-sm text-zinc-800 line-clamp-1">{q.content}</p>
          <div className="flex items-center gap-2 mt-1">
            {q.category && <CategoryBadge category={q.category} />}
            <span className="text-[10px] text-zinc-400">{q.source}</span>
            <span className="text-[10px] text-zinc-400">{fmtDate(q.createdAt)}</span>
          </div>
        </div>
      );
    }
    case "exam-papers": {
      const p = item as ExamPaper & { _createdAt?: string };
      return (
        <div>
          <p className="text-sm text-zinc-800">{p.name || "未命名试卷"}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-zinc-400">{p.questions?.length || 0} 题</span>
            <span className="text-[10px] text-zinc-400">{p.advanceMode === "auto" ? "自动" : "手动"}</span>
            <span className="text-[10px] text-zinc-400">{fmtDate(p.createdAt || p._createdAt)}</span>
          </div>
        </div>
      );
    }
    case "exam-sessions": {
      const s = item as ExamSession & { _createdAt?: string };
      return (
        <div>
          <p className="text-sm text-zinc-800">{s.paperName || "未命名考试"}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              s.status === "completed"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-amber-50 text-amber-600 border border-amber-200"
            }`}>
              {s.status === "completed" ? "已完成" : "进行中"}
            </span>
            <span className="text-[10px] text-zinc-400">{s.mode === "exam" ? "考试" : "练习"}</span>
            {s.totalScore !== undefined && (
              <span className="text-[10px] text-amber-600 font-medium">{s.totalScore}分</span>
            )}
            <span className="text-[10px] text-zinc-400">{s.answers?.length || 0}/{s.answers?.length || 0} 题</span>
            <span className="text-[10px] text-zinc-400">{fmtDate(s.startedAt || s._createdAt)}</span>
          </div>
        </div>
      );
    }
    case "mentor-evals": {
      const e = item as { _id?: string; score?: number; summary?: string; _createdAt?: string; evaluatedAt?: string } & Partial<ExamEvaluation>;
      return (
        <div>
          <div className="flex items-center gap-2">
            {e.score !== undefined && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {e.score}分
              </span>
            )}
            <p className="text-sm text-zinc-800 line-clamp-1">{e.summary || "无摘要"}</p>
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 block">{fmtDate(e.evaluatedAt || e._createdAt)}</span>
        </div>
      );
    }
  }
}

// ─── Item Detail (expanded view) ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ItemDetail({ type, item }: { type: DataType; item: any }) {
  switch (type) {
    case "history": {
      const pair = item as QAPair;
      return (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 mb-1">问题</p>
            <p className="text-xs text-zinc-700 whitespace-pre-wrap">{pair.question?.content}</p>
          </div>
          {pair.answer?.sections?.answer && (
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 mb-1">参考答案</p>
              <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">{truncate(pair.answer.sections.answer, 800)}</p>
            </div>
          )}
          {pair.answer?.metadata && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-[10px] text-zinc-400">难度: {pair.answer.metadata.difficulty}</span>
              <span className="text-[10px] text-zinc-400">字数: {pair.answer.metadata.wordCount}</span>
              <span className="text-[10px] text-zinc-400">模型: {pair.answer.modelUsed}</span>
            </div>
          )}
        </div>
      );
    }
    case "questions": {
      const q = item as BankQuestion;
      return (
        <div className="space-y-2">
          <p className="text-xs text-zinc-700 whitespace-pre-wrap">{q.content}</p>
          {q.tags && q.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {q.tags.map((t, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 text-zinc-500">{t}</span>
              ))}
            </div>
          )}
          {q.derivedFrom && (
            <p className="text-[10px] text-zinc-400">衍生自: {q.derivedFrom}</p>
          )}
        </div>
      );
    }
    case "exam-papers": {
      const p = item as ExamPaper;
      return (
        <div className="space-y-2">
          {p.questions?.map((q, i) => (
            <div key={i} className="text-xs text-zinc-700 flex gap-2">
              <span className="text-zinc-400 shrink-0">Q{i + 1}.</span>
              <span className="line-clamp-2">{q.questionContent}</span>
            </div>
          ))}
          {p.totalTimeLimit && (
            <p className="text-[10px] text-zinc-400">总时长: {Math.floor(p.totalTimeLimit / 60)} 分钟</p>
          )}
        </div>
      );
    }
    case "exam-sessions": {
      const s = item as ExamSession;
      return (
        <div className="space-y-3">
          {s.answers?.map((a, i) => (
            <div key={i} className="border-l-2 border-zinc-200 pl-3 space-y-1">
              <p className="text-xs font-medium text-zinc-700">Q{i + 1}: {truncate(a.questionContent, 60)}</p>
              {a.asrTranscript && (
                <p className="text-[11px] text-zinc-500 line-clamp-3">回答: {a.asrTranscript}</p>
              )}
              <div className="flex gap-3 text-[10px] text-zinc-400">
                <span>用时 {a.timeSpent}s / {a.timeLimit}s</span>
                {a.evaluation && <span className="text-amber-600 font-medium">{a.evaluation.score}分</span>}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "mentor-evals": {
      const e = item as Partial<ExamEvaluation> & { answerId?: string };
      return (
        <div className="space-y-2">
          {e.summary && <p className="text-xs text-zinc-700">{e.summary}</p>}
          {e.strengths && e.strengths.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-emerald-600 mb-0.5">优点</p>
              <ul className="text-xs text-zinc-600 list-disc pl-4 space-y-0.5">
                {e.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {e.weaknesses && e.weaknesses.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-rose-600 mb-0.5">不足</p>
              <ul className="text-xs text-zinc-600 list-disc pl-4 space-y-0.5">
                {e.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {e.suggestions && (
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 mb-0.5">建议</p>
              <p className="text-xs text-zinc-600">{e.suggestions}</p>
            </div>
          )}
          {e.modelUsed && <p className="text-[10px] text-zinc-400">模型: {e.modelUsed}</p>}
        </div>
      );
    }
  }
}

// ─── Category Badge ─────────────────────────────────────────────

function CategoryBadge({ category }: { category: QuestionCategory }) {
  const colors = CATEGORY_COLORS[category] || "bg-zinc-100 text-zinc-500";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors}`}>
      {category}
    </span>
  );
}
