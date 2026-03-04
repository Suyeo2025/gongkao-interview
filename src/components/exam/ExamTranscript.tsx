"use client";

import { ASRStatus } from "@/hooks/useASR";

interface ExamTranscriptProps {
  status: ASRStatus;
  transcript: string;
  interimText: string;
}

export function ExamTranscript({ status, transcript, interimText }: ExamTranscriptProps) {
  const displayText = transcript + (interimText ? interimText : "");
  const isRecording = status === "recording";

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-white/50">正在录音…</span>
        </div>
      )}

      {/* Transcript area */}
      <div className="min-h-[60px] max-h-[120px] overflow-y-auto rounded-xl bg-black/30 backdrop-blur-sm px-4 py-3 scrollbar-thin">
        {displayText ? (
          <p className="text-sm sm:text-base text-white/85 leading-relaxed">
            {transcript && <span>{transcript}</span>}
            {interimText && (
              <span className="text-amber-400/80">{interimText}</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-white/30 text-center">
            {status === "connecting" ? "正在连接语音识别…" :
             status === "recording" ? "开始说话，语音将实时转为文字…" :
             status === "processing" ? "正在处理…" :
             "点击麦克风开始录音"}
          </p>
        )}
      </div>
    </div>
  );
}
