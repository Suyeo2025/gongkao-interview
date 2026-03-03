import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json();

    if (!apiKey) {
      return Response.json({ error: "缺少 API Key" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const pager = await ai.models.list({ config: { pageSize: 100 } });

    const models: { id: string; name: string; description: string; outputTokenLimit: number | null }[] = [];

    for await (const model of pager) {
      if (
        model.name &&
        model.supportedActions?.includes("generateContent") &&
        /gemini/i.test(model.name)
      ) {
        const id = model.name.replace(/^models\//, "");
        models.push({
          id,
          name: model.displayName || id,
          description: model.description || "",
          outputTokenLimit: model.outputTokenLimit ?? null,
        });
      }
    }

    // Sort: latest/recommended first
    models.sort((a, b) => {
      const rank = (id: string) => {
        if (id.includes("2.5-pro")) return 0;
        if (id.includes("2.5-flash-lite")) return 2;
        if (id.includes("2.5-flash")) return 1;
        if (id.includes("2.0-flash")) return 3;
        return 10;
      };
      return rank(a.id) - rank(b.id);
    });

    return Response.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取模型列表失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
