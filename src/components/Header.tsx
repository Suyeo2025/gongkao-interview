"use client";

import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/user-context";

interface HeaderProps {
  onOpenSettings: () => void;
  onToggleSidebar?: () => void;
}

export function Header({ onOpenSettings, onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const user = useUser();
  const [showPwdChange, setShowPwdChange] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleLogout = useCallback(async () => {
    localStorage.removeItem("gongkao_user");
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);

  const handlePasswordChange = async () => {
    if (!oldPwd || !newPwd) return;
    setPwdError("");
    setPwdLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwdError(data.error || "修改失败");
      } else {
        setPwdSuccess(true);
        setOldPwd("");
        setNewPwd("");
      }
    } catch {
      setPwdError("网络错误");
    } finally {
      setPwdLoading(false);
    }
  };

  const openPwdChange = () => {
    setOldPwd("");
    setNewPwd("");
    setPwdError("");
    setPwdSuccess(false);
    setShowPwdChange(true);
  };

  return (
    <>
      <header className="h-12 sm:h-14 bg-white/80 backdrop-blur-xl px-2 sm:px-4 md:px-6 flex items-center justify-between shrink-0 border-b border-zinc-100">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile hamburger menu */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-10 w-10 text-zinc-600"
            onClick={onToggleSidebar}
          >
            <Icon name="menu" size={22} />
          </Button>

          <Logo className="w-7 h-7 sm:w-8 sm:h-8" />
          <div>
            <h1 className="text-xs sm:text-sm font-semibold text-zinc-800 tracking-tight">登科录</h1>
            <p className="text-[10px] text-zinc-400 hidden sm:block">笔墨之间 · 登科有路</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* Username display */}
          {user && (
            <span className="text-[11px] text-zinc-400 mr-1 hidden sm:inline">
              {user.username}
            </span>
          )}

          {/* Admin panel link */}
          {user?.role === "admin" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin")}
              className="gap-1.5 text-zinc-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg h-10 px-2.5"
            >
              <Icon name="admin_panel_settings" size={20} />
              <span className="hidden sm:inline text-xs font-medium">管理</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/exam")}
            className="gap-1.5 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg h-10 px-2.5"
          >
            <Icon name="quiz" size={20} />
            <span className="hidden sm:inline text-xs font-medium">模考</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            className="h-10 w-10 text-zinc-500 hover:text-zinc-800 rounded-lg"
          >
            <Icon name="settings" size={20} />
            <span className="sr-only">设置</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={openPwdChange}
            className="h-10 w-10 text-zinc-500 hover:text-zinc-800 rounded-lg"
            title="修改密码"
          >
            <Icon name="key" size={20} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-10 w-10 text-zinc-500 hover:text-zinc-800 rounded-lg"
          >
            <Icon name="logout" size={20} />
            <span className="sr-only">退出</span>
          </Button>
        </div>
      </header>

      {/* Password change dialog - rendered outside header */}
      {showPwdChange && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setShowPwdChange(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">修改密码</h3>
              <button type="button" onClick={() => setShowPwdChange(false)} className="text-zinc-400 hover:text-zinc-600">
                <Icon name="close" size={18} />
              </button>
            </div>

            {pwdSuccess ? (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                  <Icon name="check_circle" size={18} className="text-emerald-600 shrink-0" />
                  <span className="text-xs text-emerald-700">密码修改成功</span>
                </div>
                <Button variant="outline" onClick={() => setShowPwdChange(false)} className="w-full rounded-xl h-10 text-sm">
                  关闭
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">原密码</label>
                    <Input
                      type="password"
                      value={oldPwd}
                      onChange={(e) => setOldPwd(e.target.value)}
                      placeholder="输入当前密码"
                      className="h-10 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">新密码</label>
                    <Input
                      type="password"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="输入新密码（至少4位）"
                      className="h-10 rounded-xl text-sm"
                    />
                  </div>
                </div>
                {pwdError && (
                  <p className="text-xs text-red-500 bg-red-50/80 rounded-lg px-3 py-2">{pwdError}</p>
                )}
                <Button
                  onClick={handlePasswordChange}
                  disabled={!oldPwd || !newPwd || newPwd.length < 4 || pwdLoading}
                  className="w-full bg-gradient-to-r from-zinc-700 to-zinc-800 hover:from-zinc-800 hover:to-zinc-900 text-white rounded-xl h-10 text-sm"
                >
                  {pwdLoading ? "修改中…" : "确认修改"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
