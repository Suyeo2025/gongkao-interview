import { listVoices, removeVoice, addVoice } from "@/lib/custom-voices";
import { CustomVoice } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const voices = listVoices();
  return Response.json({ voices });
}

/** Add a voice_id directly (without calling DashScope) */
export async function POST(req: Request) {
  try {
    const { voiceId, name, targetModel } = await req.json();

    if (!voiceId?.trim()) {
      return Response.json({ error: "缺少 voiceId" }, { status: 400 });
    }

    const voice: CustomVoice = {
      voiceId: voiceId.trim(),
      name: (name || "自定义音色").trim(),
      targetModel: targetModel || "cosyvoice-v3-flash",
      createdAt: new Date().toISOString(),
    };

    addVoice(voice);
    return Response.json({ success: true, voice });
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存失败";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const voiceId = searchParams.get("voiceId");

  if (!voiceId) {
    return Response.json({ error: "缺少 voiceId" }, { status: 400 });
  }

  const removed = removeVoice(voiceId);
  return Response.json({ success: removed });
}
