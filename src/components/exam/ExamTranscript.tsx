"use client";

import { ASRStatus } from "@/hooks/useASR";

interface ExamTranscriptProps {
  status: ASRStatus;
  transcript: string;
  audioUrl: string | null;
}

export function ExamTranscript({ status, transcript, audioUrl }: ExamTranscriptProps) {
  const isRecording = status === "recording";
  const isProcessing = status === "processing";

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-white/50">正在录音…</span>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
          <span className="text-xs text-white/50">语音识别中…</span>
        </div>
      )}

      {/* Transcript area */}
      <div className="min-h-[60px] max-h-[120px] overflow-y-auto rounded-xl bg-black/30 backdrop-blur-sm px-4 py-3 scrollbar-thin">
        {transcript ? (
          <div>
            <p className="text-sm sm:text-base text-white/85 leading-relaxed">
              {transcript}
            </p>
            {/* Playback */}
            {audioUrl && status === "idle" && (
              <div className="mt-2">
                <audio controls src={audioUrl} className="w-full h-8 opacity-70" />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/30 text-center">
            {isRecording ? "正在录音，停止后将识别为文字…" :
             isProcessing ? "正在处理录音…" :
             "点击麦克风开始录音"}
          </p>
        )}
      </div>
    </div>
  );
}
