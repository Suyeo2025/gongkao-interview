"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!username.trim() || !password.trim()) return;

      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "登录失败");
          return;
        }

        // Store user info for client-side context
        if (data.user) {
          localStorage.setItem("gongkao_user", JSON.stringify(data.user));
        }

        // Auto-migrate localStorage data to server on login
        try {
          const migrationData: Record<string, unknown> = {};
          const keys = [
            ["gongkao_settings", "settings"],
            ["gongkao_history", "history"],
            ["gongkao_question_bank", "questionBank"],
            ["gongkao_exam_papers", "examPapers"],
            ["gongkao_exam_sessions", "examSessions"],
            ["gongkao_mentor_evals", "mentorEvals"],
          ] as const;
          for (const [lsKey, bodyKey] of keys) {
            const raw = localStorage.getItem(lsKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && (Array.isArray(parsed) ? parsed.length > 0 : Object.keys(parsed).length > 0)) {
                migrationData[bodyKey] = parsed;
              }
            }
          }
          if (Object.keys(migrationData).length > 0) {
            await fetch("/api/data/migrate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(migrationData),
            });
          }
        } catch {
          // Migration is best-effort
        }

        router.push("/");
        router.refresh();
      } catch {
        setError("网络错误，请重试");
      } finally {
        setLoading(false);
      }
    },
    [username, password, router]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-stone-50 to-stone-100 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="flex items-center justify-center mx-auto mb-4 sm:mb-5">
            <Logo className="w-16 h-16 sm:w-20 sm:h-20" />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-stone-800 tracking-wider">
            登科录
          </h1>
          <div className="w-12 h-0.5 bg-gradient-to-r from-zinc-400 to-zinc-500 mx-auto mt-3 rounded-full" />
          <p className="text-sm text-stone-400 mt-3">笔墨之间 · 登科有路</p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-stone-200/40 border-t-2 border-t-zinc-400/60 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.08)] p-6 space-y-5"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">账号</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号"
              autoComplete="username"
              className="w-full h-11 px-3.5 rounded-xl border border-stone-200/60 bg-stone-50/50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-300 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              className="w-full h-11 px-3.5 rounded-xl border border-stone-200/60 bg-stone-50/50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-300 transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50/80 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-zinc-700 to-zinc-800 text-white text-sm font-semibold shadow-sm shadow-zinc-300/30 hover:from-zinc-800 hover:to-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all tracking-wide"
          >
            {loading ? "登录中..." : "登 录"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-stone-400 mt-6">
          登科录 · 结构化作答 · 智能点评
        </p>
      </div>
    </div>
  );
}
