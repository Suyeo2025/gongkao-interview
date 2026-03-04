import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { SectionKey } from "@/lib/types";

export const runtime = "nodejs";

const SECTION_NAMES: Record<SectionKey, string> = {
  answer: "考生作答（现场口吻）",
  review: "作答复盘（10秒速览）",
  template: "通用模板（可复用）",
  pitfalls: "踩坑提醒",
  notes: "注意事项",
};

function buildPrompt(
  sectionKey: SectionKey,
  question: string,
  currentContent: string,
  instruction: string
): string {
  return `你是公考面试资深教练。用户正在修改一道面试题的「${SECTION_NAMES[sectionKey]}」板块。

原始面试题目：
${question}

当前板块内容：
${currentContent}

用户的修改要求：
${instruction}

请根据用户的要求，重新生成该板块的内容。
- 只输出该板块的内容，不要包含板块标题（如【一、...】）
- 不要输出其他板块
- 不要输出 meta 数据块
- 保持专业面试辅导的语气和质量`;
}

async function regenerateGemini(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  config: { modelName?: string; temperature?: number }
) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContentStream({
    model: config.modelName || "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: config.temperature ?? 0.7,
    },
  });

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response) {
          if (chunk.text) {
            controller.enqueue(new TextEncoder().encode(chunk.text));
          }
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成过程中出错";
        controller.enqueue(new TextEncoder().encode(`\n\n---\n**错误**: ${message}`));
        controller.close();
      }
    },
  });
}

async function regenerateQwen(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  config: { modelName?: string; temperature?: number }
) {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });

  const response = await client.chat.completions.create({
    model: config.modelName || "qwen-plus",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: config.temperature ?? 0.7,
    stream: true,
  });

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成过程中出错";
        controller.enqueue(new TextEncoder().encode(`\n\n---\n**错误**: ${message}`));
        controller.close();
      }
    },
  });
}

export async function POST(req: Request) {
  try {
    const { question, sectionKey, currentContent, instruction, provider, apiKey, config } =
      await req.json();

    if (!apiKey) {
      return Response.json(
        { error: `请先在设置中配置 ${provider === "qwen" ? "DashScope" : "Gemini"} API Key` },
        { status: 400 }
      );
    }

    if (!instruction?.trim()) {
      return Response.json({ error: "请输入修改要求" }, { status: 400 });
    }

    const systemPrompt = buildPrompt(sectionKey, question, currentContent, instruction);

    const stream =
      provider === "qwen"
        ? await regenerateQwen(instruction, systemPrompt, apiKey, config || {})
        : await regenerateGemini(instruction, systemPrompt, apiKey, config || {});

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "服务器错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
