"use client";

import { Settings2, Download, Upload, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportData, importData } from "@/lib/storage";
import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  onOpenSettings: () => void;
  onDataChange?: () => void;
}

export function Header({ onOpenSettings, onDataChange }: HeaderProps) {
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
    <header className="h-14 bg-white/80 backdrop-blur-xl px-6 flex items-center justify-between shrink-0 border-b border-zinc-100">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm">
          <span className="text-white text-sm font-bold">考</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-zinc-800 tracking-tight">公考面试模拟助手</h1>
          <p className="text-[10px] text-zinc-400">AI 驱动 · 五板块结构化作答</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExport}
          className="gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 rounded-lg"
        >
          <Download className="h-3.5 w-3.5" />
          导出
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleImport}
          className="gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 rounded-lg"
        >
          <Upload className="h-3.5 w-3.5" />
          导入
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettings}
          className="gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 rounded-lg"
        >
          <Settings2 className="h-3.5 w-3.5" />
          设置
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 rounded-lg"
        >
          <LogOut className="h-3.5 w-3.5" />
          退出
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
