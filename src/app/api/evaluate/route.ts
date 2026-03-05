import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { EVALUATION_PROMPT } from "@/lib/prompt";

export const runtime = "nodejs";

interface AnswerInput {
  questionIndex: number;
  questionContent: string;
  asrTranscript: string;
  timeSpent: number;
  timeLimit: number;
}

function buildUserPrompt(answers: AnswerInput[]): string {
  return answers
    .map(
      (a, i) =>
        `## 第 ${i + 1} 题\n**题目**：${a.questionContent}\n**考生作答**（语音转写，用时 ${a.timeSpent}秒/${a.timeLimit}秒）：\n${a.asrTranscript || "（未作答）"}`
    )
    .join("\n\n---\n\n");
}

async function evaluateGemini(
  answers: AnswerInput[],
  apiKey: string,
  config: { modelName?: string; temperature?: number }
) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContentStream({
    model: config.modelName || "gemini-2.5-flash",
    contents: buildUserPrompt(answers),
    config: {
      systemInstruction: EVALUATION_PROMPT,
      temperature: config.temperature ?? 0.5,
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
        const message = err instanceof Error ? err.message : "评估出错";
        controller.enqueue(new TextEncoder().encode(`\n\n---\n**错误**: ${message}`));
        controller.close();
      }
    },
  });
}

function isThinkingModel(modelName: string): boolean {
  return /qwen3/.test(modelName);
}

async function evaluateQwen(
  answers: AnswerInput[],
  apiKey: string,
  config: { modelName?: string; temperature?: number }
) {
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
      { role: "system", content: EVALUATION_PROMPT },
      { role: "user", content: buildUserPrompt(answers) },
    ],
    temperature: config.temperature ?? 0.5,
    stream: true,
  };
  if (thinking) createParams.enable_thinking = true;

  const response = await client.chat.completions.create(createParams) as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

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
        const message = err instanceof Error ? err.message : "评估出错";
        controller.enqueue(new TextEncoder().encode(`\n\n---\n**错误**: ${message}`));
        controller.close();
      }
    },
  });
}

export async function POST(req: Request) {
  try {
    const { answers, apiKey, provider, config } = await req.json();

    if (!apiKey) {
      return Response.json(
        { error: `请先配置 ${provider === "qwen" ? "DashScope" : "Gemini"} API Key` },
        { status: 400 }
      );
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return Response.json({ error: "没有需要评估的作答" }, { status: 400 });
    }

    const stream =
      provider === "qwen"
        ? await evaluateQwen(answers, apiKey, config || {})
        : await evaluateGemini(answers, apiKey, config || {});

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
