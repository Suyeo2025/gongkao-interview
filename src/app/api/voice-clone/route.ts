import { addVoice } from "@/lib/custom-voices";
import { CustomVoice } from "@/lib/types";

export const runtime = "nodejs";

const DASHSCOPE_API = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization";

export async function POST(req: Request) {
  try {
    const { apiKey, name, targetModel, audioUrl } = await req.json();

    if (!apiKey) {
      return Response.json({ error: "请先配置 DashScope API Key" }, { status: 400 });
    }
    if (!audioUrl?.trim()) {
      return Response.json({ error: "请提供音频公网 URL" }, { status: 400 });
    }

    const prefix = (name || "custom")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 8) || "custom";

    const res = await fetch(DASHSCOPE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "voice-enrollment",
        input: {
          action: "create_voice",
          target_model: targetModel || "cosyvoice-v3-flash",
          prefix,
          url: audioUrl.trim(),
          language_hints: ["zh"],
        },
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.output?.voice_id) {
      const msg = data.message || data.output?.message || `声音复刻失败 (HTTP ${res.status})`;
      return Response.json({ error: msg }, { status: 400 });
    }

    const voiceId = data.output.voice_id;
    const useModel = targetModel || "cosyvoice-v3-flash";
    const useName = (name || "自定义音色").trim();

    const voice: CustomVoice = {
      voiceId,
      name: useName,
      targetModel: useModel,
      createdAt: new Date().toISOString(),
    };
    addVoice(voice);

    return Response.json({ voiceId, name: useName, targetModel: useModel });
  } catch (err) {
    const message = err instanceof Error ? err.message : "声音复刻失败";
    console.error("[VoiceClone] error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
