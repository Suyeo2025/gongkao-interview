"use client";

import { Icon } from "@/components/Icon";

interface ExamTimerProps {
  seconds: number;
  visible: boolean;
  running: boolean;
  onToggleVisibility: () => void;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ExamTimer({ seconds, visible, running, onToggleVisibility }: ExamTimerProps) {
  const isWarning = seconds <= 30 && seconds > 10;
  const isDanger = seconds <= 10;

  const colorClass = isDanger
    ? "text-red-400"
    : isWarning
      ? "text-amber-400"
      : "text-white/90";

  const pulseClass = isDanger && running ? "animate-pulse" : "";

  return (
    <button
      type="button"
      onClick={onToggleVisibility}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/50 transition-colors"
      title={visible ? "隐藏秒表" : "显示秒表"}
    >
      <Icon
        name={visible ? "timer" : "visibility_off"}
        size={16}
        className="text-white/60"
      />
      {visible ? (
        <span className={`font-mono text-sm font-semibold tabular-nums ${colorClass} ${pulseClass}`}>
          {formatCountdown(seconds)}
        </span>
      ) : (
        <span className="text-xs text-white/40">秒表已隐藏</span>
      )}
    </button>
  );
}
