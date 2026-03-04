import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export const runtime = "nodejs";

const CLASSIFY_PROMPT = `你是公务员面试题型分类专家。
给你一道面试题，请判断它属于以下哪个类型，只输出类型名称，不要任何其他文字：
- 综合分析
- 组织策划
- 人际沟通
- 情景模拟
- 应急应变

只回复类型名称，例如：综合分析`;

const VALID_CATEGORIES = ["综合分析", "组织策划", "人际沟通", "情景模拟", "应急应变"];

async function classifyGemini(question: string, apiKey: string, modelName?: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: modelName || "gemini-2.5-flash",
    contents: question,
    config: {
      systemInstruction: CLASSIFY_PROMPT,
      temperature: 0.1,
    },
  });
  return response.text?.trim() || "";
}

async function classifyQwen(question: string, apiKey: string, modelName?: string): Promise<string> {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });
  const response = await client.chat.completions.create({
    model: modelName || "qwen-turbo",
    messages: [
      { role: "system", content: CLASSIFY_PROMPT },
      { role: "user", content: question },
    ],
    temperature: 0.1,
  });
  return response.choices[0]?.message?.content?.trim() || "";
}

export async function POST(req: Request) {
  try {
    const { question, apiKey, provider, modelName } = await req.json();

    if (!apiKey) {
      return Response.json({ error: "缺少 API Key" }, { status: 400 });
    }
    if (!question?.trim()) {
      return Response.json({ error: "缺少题目内容" }, { status: 400 });
    }

    const result = provider === "qwen"
      ? await classifyQwen(question, apiKey, modelName)
      : await classifyGemini(question, apiKey, modelName);

    const category = VALID_CATEGORIES.find((c) => result.includes(c)) || null;

    return Response.json({ category });
  } catch (err) {
    const message = err instanceof Error ? err.message : "分类失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
