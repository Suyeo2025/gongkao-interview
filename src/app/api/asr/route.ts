import { randomUUID } from "crypto";
import { createSession, getSession, deleteSession } from "@/lib/asr-sessions";

export const runtime = "nodejs";

/**
 * GET /api/asr?apiKey=xxx
 * Opens DashScope WebSocket and returns an SSE stream with real-time transcription.
 * Returns sessionId in the first event so the client can send audio via POST.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const apiKey = url.searchParams.get("apiKey");

  if (!apiKey) {
    return Response.json({ error: "缺少 API Key" }, { status: 400 });
  }

  const sessionId = randomUUID();
  const taskId = randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const push = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      };

      const close = () => {
        try { controller.close(); } catch { /* already closed */ }
      };

      // Send sessionId immediately so client can start sending audio
      push("session", { sessionId });

      createSession(sessionId, taskId, apiKey, push, close);
    },
    cancel() {
      deleteSession(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * POST /api/asr
 * Send audio chunk or stop signal.
 * Body: { sessionId, action: "audio" | "stop", audio?: string (base64) }
 */
export async function POST(req: Request) {
  try {
    const { sessionId, action, audio } = await req.json();
    const session = getSession(sessionId);

    if (!session) {
      return Response.json({ error: "会话不存在或已结束" }, { status: 404 });
    }

    if (action === "audio" && audio) {
      const buf = Buffer.from(audio, "base64");
      if (session.ws.readyState === 1 /* OPEN */) {
        session.ws.send(buf);
      }
      return Response.json({ ok: true });
    }

    if (action === "stop") {
      if (session.ws.readyState === 1) {
        session.ws.send(JSON.stringify({
          header: {
            action: "finish-task",
            task_id: session.taskId,
            streaming: "duplex",
          },
          payload: { input: {} },
        }));
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: "未知 action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
