import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { apiKey, provider } = await req.json();

    if (!apiKey) {
      return Response.json({ error: "缺少 API Key" }, { status: 400 });
    }

    if (provider === "tts") {
      return await listTTSModels(apiKey);
    }

    if (provider === "qwen") {
      return await listQwenModels(apiKey);
    }

    return await listGeminiModels(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取模型列表失败";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function listGeminiModels(apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const pager = await ai.models.list({ config: { pageSize: 100 } });

  const models: { id: string; name: string; description: string }[] = [];

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
      });
    }
  }

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
}

async function listTTSModels(apiKey: string) {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });

    const list = await client.models.list();
    const models: { id: string; name: string; description: string }[] = [];

    for await (const model of list) {
      if (/cosyvoice/i.test(model.id)) {
        models.push({
          id: model.id,
          name: model.id,
          description: "",
        });
      }
    }

    // Filter: only keep v3 models (v3.5 requires custom voices, v2 deprecated)
    const filtered = models.filter(m =>
      m.id.includes("v3-flash") || m.id.includes("v3-plus")
    );

    filtered.sort((a, b) => {
      const rank = (id: string) => {
        if (id.includes("v3-flash")) return 0;
        if (id.includes("v3-plus")) return 1;
        return 10;
      };
      return rank(a.id) - rank(b.id);
    });

    if (filtered.length > 0) {
      return Response.json({ models: filtered });
    }

    // If no matching models found via API, return fallback
    throw new Error("no models");
  } catch {
    const fallback = [
      { id: "cosyvoice-v3-flash", name: "CosyVoice v3 Flash", description: "推荐 · 支持系统音色" },
      { id: "cosyvoice-v3-plus", name: "CosyVoice v3 Plus", description: "高品质合成" },
    ];
    return Response.json({ models: fallback });
  }
}

async function listQwenModels(apiKey: string) {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });

    const list = await client.models.list();
    const models: { id: string; name: string; description: string }[] = [];

    for await (const model of list) {
      if (/^qwen/i.test(model.id)) {
        models.push({
          id: model.id,
          name: model.id,
          description: "",
        });
      }
    }

    models.sort((a, b) => {
      const rank = (id: string) => {
        if (id === "qwen-max") return 0;
        if (id === "qwen-plus") return 1;
        if (id === "qwen-turbo") return 2;
        if (id.includes("max")) return 3;
        if (id.includes("plus")) return 4;
        if (id.includes("turbo")) return 5;
        return 10;
      };
      return rank(a.id) - rank(b.id);
    });

    return Response.json({ models });
  } catch {
    // Fallback: return hardcoded list
    const fallback = [
      { id: "qwen-max", name: "Qwen Max", description: "最强推理能力" },
      { id: "qwen-plus", name: "Qwen Plus", description: "推荐 - 性能均衡" },
      { id: "qwen-turbo", name: "Qwen Turbo", description: "最快响应速度" },
      { id: "qwen3-max", name: "Qwen3 Max", description: "最新旗舰" },
      { id: "qwen3.5-plus", name: "Qwen3.5 Plus", description: "最新 Plus" },
    ];
    return Response.json({ models: fallback });
  }
}
