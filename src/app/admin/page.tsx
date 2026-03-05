"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/Icon";

interface UserInfo {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  _count: {
    history: number;
    questions: number;
    examPapers: number;
    examSessions: number;
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"member" | "admin">("member");
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 403) {
        router.push("/");
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "创建失败");
        return;
      }
      setNewUsername("");
      setNewPassword("");
      setNewRole("member");
      setShowCreate(false);
      fetchUsers();
    } catch {
      setError("创建失败");
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`确定删除用户 "${username}"？所有数据将被清除。`)) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    fetchUsers();
  };

  // Password reset state
  const [resetTarget, setResetTarget] = useState<{ id: string; username: string } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pwd = "";
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  const openResetDialog = (id: string, username: string) => {
    setResetTarget({ id, username });
    setResetPassword(generatePassword());
    setResetDone(false);
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !resetPassword.trim()) return;
    setResetLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      if (res.ok) setResetDone(true);
    } catch { /* ignore */ }
    finally { setResetLoading(false); }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(resetPassword);
  };

  return (
    <div className="min-h-screen bg-zinc-50/50">
      <header className="h-12 sm:h-14 bg-white/80 backdrop-blur-xl px-3 sm:px-6 flex items-center justify-between shrink-0 border-b border-zinc-100">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-500" onClick={() => router.push("/")}>
            <Icon name="arrow_back" size={20} />
          </Button>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-zinc-800 flex items-center justify-center shadow-sm">
            <Icon name="admin_panel_settings" size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-semibold text-zinc-800 tracking-tight">管理员面板</h1>
            <p className="text-[10px] text-zinc-400 hidden sm:block">用户管理 · 数据查看</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Create user */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">用户列表</h2>
          <Button
            size="sm"
            className="gap-1.5 rounded-xl h-9 text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
            onClick={() => setShowCreate(!showCreate)}
          >
            <Icon name={showCreate ? "close" : "person_add"} size={16} />
            {showCreate ? "取消" : "创建用户"}
          </Button>
        </div>

        {showCreate && (
          <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">用户名</label>
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="输入用户名"
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">密码</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="输入密码"
                  className="h-9 rounded-xl text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">角色</label>
              <div className="flex gap-2">
                {(["member", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewRole(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      newRole === r
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                    }`}
                  >
                    {r === "admin" ? "管理员" : "成员"}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button
              onClick={handleCreate}
              disabled={!newUsername.trim() || !newPassword.trim()}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl h-9 text-sm"
            >
              创建
            </Button>
          </div>
        )}

        {/* User list */}
        {loading ? (
          <div className="text-center py-12 text-zinc-400">
            <Icon name="progress_activity" size={24} className="animate-spin mx-auto mb-2" />
            <p className="text-sm">加载中...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            <p className="text-sm">暂无用户</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="bg-white rounded-xl border border-zinc-200/60 px-4 py-3 flex items-center justify-between group cursor-pointer hover:border-amber-200 transition-colors"
                onClick={() => router.push(`/admin/users/${u.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-800">{u.username}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      u.role === "admin"
                        ? "bg-amber-100 text-amber-700 border border-amber-200"
                        : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                    }`}>
                      {u.role === "admin" ? "管理员" : "成员"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-400">
                    <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                    <span>历史 {u._count.history}</span>
                    <span>题库 {u._count.questions}</span>
                    <span>试卷 {u._count.examPapers}</span>
                    <span>考试 {u._count.examSessions}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openResetDialog(u.id, u.username); }}
                    className="p-1.5 rounded-lg text-zinc-300 hover:text-amber-600 hover:bg-amber-50 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                    title="重置密码"
                  >
                    <Icon name="key" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(u.id, u.username); }}
                    className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                    title="删除用户"
                  >
                    <Icon name="delete" size={16} />
                  </button>
                  <Icon name="chevron_right" size={16} className="text-zinc-300 group-hover:text-amber-500 transition-colors ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Password reset dialog */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setResetTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">
                重置密码 · {resetTarget.username}
              </h3>
              <button type="button" onClick={() => setResetTarget(null)} className="text-zinc-400 hover:text-zinc-600">
                <Icon name="close" size={18} />
              </button>
            </div>

            {!resetDone ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">新密码</label>
                  <div className="flex gap-2">
                    <Input
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="输入或生成密码"
                      className="h-10 rounded-xl text-sm font-mono flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl shrink-0"
                      onClick={() => setResetPassword(generatePassword())}
                      title="生成随机密码"
                    >
                      <Icon name="casino" size={18} />
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handleResetPassword}
                  disabled={!resetPassword.trim() || resetLoading}
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
                      {resetPassword}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl shrink-0"
                      onClick={copyPassword}
                      title="复制密码"
                    >
                      <Icon name="content_copy" size={18} />
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setResetTarget(null)}
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
