import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "@/lib/prompt";

export const runtime = "nodejs";

async function generateGemini(question: string, apiKey: string, config: { modelName?: string; temperature?: number }) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContentStream({
    model: config.modelName || "gemini-2.5-flash",
    contents: question,
    config: {
      systemInstruction: SYSTEM_PROMPT,
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

function isThinkingModel(modelName: string): boolean {
  return /qwen3/.test(modelName);
}

async function generateQwen(question: string, apiKey: string, config: { modelName?: string; temperature?: number }) {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });

  const modelName = config.modelName || "qwen-plus";
  const thinking = isThinkingModel(modelName);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createParams: any = {
    model: modelName,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ],
    temperature: config.temperature ?? 0.7,
    stream: true,
  };
  if (thinking) createParams.enable_thinking = true;

  const response = await client.chat.completions.create(createParams) as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

  return new ReadableStream({
    async start(controller) {
      try {
        let inThinking = thinking;
        if (thinking) {
          controller.enqueue(new TextEncoder().encode("<!--thinking-->"));
        }
        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta as Record<string, unknown>;
          // reasoning_content = thinking phase, content = answer phase
          const reasoningText = delta?.reasoning_content as string | undefined;
          const contentText = delta?.content as string | undefined;

          if (reasoningText) {
            controller.enqueue(new TextEncoder().encode(reasoningText));
          }
          if (contentText) {
            if (inThinking) {
              controller.enqueue(new TextEncoder().encode("<!--/thinking-->"));
              inThinking = false;
            }
            controller.enqueue(new TextEncoder().encode(contentText));
          }
        }
        if (inThinking) {
          controller.enqueue(new TextEncoder().encode("<!--/thinking-->"));
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
    const { question, apiKey, provider, config } = await req.json();

    if (!apiKey) {
      return Response.json(
        { error: `请先在设置中配置 ${provider === "qwen" ? "DashScope" : "Gemini"} API Key` },
        { status: 400 }
      );
    }

    if (!question?.trim()) {
      return Response.json({ error: "请输入面试题目" }, { status: 400 });
    }

    const stream = provider === "qwen"
      ? await generateQwen(question.trim(), apiKey, config || {})
      : await generateGemini(question.trim(), apiKey, config || {});

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
