import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const PARSE_PROMPT = `你是一个面试题提取助手。请从以下文档中提取所有公务员面试题目。

要求：
1. 只提取问题/题目本身，不要提取答案或解析
2. 每道题保持完整原文
3. 如果能判断题目类型，归类到以下之一：综合分析、组织策划、人际沟通、情景模拟、应急应变
4. 返回 JSON 数组格式

返回格式（严格 JSON，不要加 markdown 围栏）：
[{"content": "题目内容", "category": "综合分析"}, ...]

如果无法判断类别，category 设为 null。
如果文档中没有找到面试题目，返回空数组 []。`;

export async function POST(req: Request) {
  try {
    const { fileData, mimeType, apiKey } = await req.json();

    if (!apiKey) {
      return Response.json({ error: "请先配置 Gemini API Key" }, { status: 400 });
    }
    if (!fileData) {
      return Response.json({ error: "缺少文件数据" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: fileData, mimeType: mimeType || "application/pdf" } },
            { text: PARSE_PROMPT },
          ],
        },
      ],
      config: {
        temperature: 0.1,
      },
    });

    const text = response.text?.trim() || "[]";

    // Strip markdown fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    try {
      const questions = JSON.parse(cleaned);
      if (!Array.isArray(questions)) {
        return Response.json({ error: "AI 返回格式错误" }, { status: 500 });
      }
      return Response.json({
        questions: questions.map((q: { content?: string; category?: string | null }) => ({
          content: q.content || "",
          category: q.category || null,
        })).filter((q: { content: string }) => q.content.trim().length > 0),
      });
    } catch {
      return Response.json({ error: "AI 返回内容无法解析为 JSON" }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "文件解析失败";
    console.error("[parse-file] error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
