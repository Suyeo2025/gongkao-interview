import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "@/lib/prompt";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { question, apiKey, config } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "请先在设置中配置 Gemini API Key" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!question?.trim()) {
      return new Response(
        JSON.stringify({ error: "请输入面试题目" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContentStream({
      model: config?.modelName || "gemini-2.5-flash",
      contents: question.trim(),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: config?.temperature ?? 0.7,
      },
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            if (chunk.text) {
              controller.enqueue(new TextEncoder().encode(chunk.text));
            }
          }
          controller.close();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "生成过程中出错";
          controller.enqueue(
            new TextEncoder().encode(`\n\n---\n**错误**: ${message}`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "服务器错误";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
