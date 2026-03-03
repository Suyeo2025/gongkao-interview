"use client";

import { Icon } from "./Icon";
import { Button } from "@/components/ui/button";
import { exportData, importData } from "@/lib/storage";
import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  onOpenSettings: () => void;
  onDataChange?: () => void;
  onToggleSidebar?: () => void;
}

export function Header({ onOpenSettings, onDataChange, onToggleSidebar }: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);

  const handleExport = useCallback(() => {
    const json = exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gongkao-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ok = importData(reader.result as string);
        if (ok) {
          onDataChange?.();
          window.location.reload();
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [onDataChange]
  );

  return (
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

        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
          <span className="text-white text-xs sm:text-sm font-bold">考</span>
        </div>
        <div>
          <h1 className="text-xs sm:text-sm font-semibold text-zinc-800 tracking-tight">公考面试模拟助手</h1>
          <p className="text-[10px] text-zinc-400 hidden sm:block">AI 驱动 · 五板块结构化作答</p>
        </div>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleExport}
          className="h-10 w-10 text-zinc-500 hover:text-zinc-800 rounded-lg"
        >
          <Icon name="download" size={20} />
          <span className="sr-only">导出</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleImport}
          className="h-10 w-10 text-zinc-500 hover:text-zinc-800 rounded-lg"
        >
          <Icon name="upload" size={20} />
          <span className="sr-only">导入</span>
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
          onClick={handleLogout}
          className="h-10 w-10 text-zinc-500 hover:text-zinc-800 rounded-lg"
        >
          <Icon name="logout" size={20} />
          <span className="sr-only">退出</span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </header>
  );
}
