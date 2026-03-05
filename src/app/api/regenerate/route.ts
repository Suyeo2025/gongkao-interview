import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { SectionKey } from "@/lib/types";

export const runtime = "nodejs";

const SECTION_NAMES: Record<SectionKey, string> = {
  answer: "考生作答（现场口吻）",
  review: "本质锚点",
  template: "柔性高分句库（可复用）",
  pitfalls: "落地动作清单（2+1）",
  notes: "跑题预警线",
};

const SECTION_PRINCIPLES: Record<SectionKey, string> = {
  answer: `考生作答的核心原则——这是一个人在说话，不是一篇文章。考生看完能记住、上了考场能复述出来。

语感规则：
- 以"考官您好……"开头
- 禁用一切程式化衔接词："首先/其次/再次/最后""先/再/同时/另外""第一/第二/第三"全部禁止
- 用语义本身推动节奏，像说话一样自然递进（如"说到底就是……""处理这件事，关键在……""光做到这一步还不够……"）
- 句子要短，一口气能说完。长句拆成两三个短句
- 每说完一层意思，用一句短的"定性句"收住，再自然过渡——这是说话时的呼吸感
- 措施不贪多，2个核心动作说透 + 1个兜底
- 亮点融在说话里自然冒出来，不单独展示
- 350—450字，约2分钟
- 禁止：万能废话、空泛流程、硬背条文、夸张煽情`,

  review: `本质锚点——用"不是……而是……"或"表面是……核心是……"结构，一句话把题目本质钉死，≤25字。平实书面语，不加语气词。`,

  template: `柔性高分句库——给出6句可直接套用的"有温度但有力量"的句子：每句≤18字，不官腔不空泛，能在考场自然说出口。类型覆盖：稳情绪、讲原则、给方案、促共识、兜底、收束。平实书面语。`,

  pitfalls: `落地动作清单（2+1）——2个核心动作（责任人+动作+节点）+ 1个兜底预案（最坏情况+处置）+ 1个复盘收束（回访/固化）。平实书面语。`,

  notes: `跑题预警线——2条"红线"，用"别把……答成……"句式提醒。平实书面语。`,
};

function buildPrompt(
  sectionKey: SectionKey,
  question: string,
  currentContent: string,
  instruction: string,
  allSections?: Record<string, string>
): string {
  const sectionContext = allSections
    ? `\n\n其他板块内容（供参考，确保一致性）：\n${Object.entries(allSections)
        .filter(([k]) => k !== sectionKey)
        .map(([k, v]) => `【${SECTION_NAMES[k as SectionKey]}】\n${v}`)
        .join("\n\n")}`
    : "";

  return `你是公考面试灵魂型高分教练。用户正在修改一道面试题的「${SECTION_NAMES[sectionKey]}」板块。

该板块的写作原则：
${SECTION_PRINCIPLES[sectionKey]}

原始面试题目：
${question}

当前板块内容（上一版本）：
${currentContent}
${sectionContext}

用户的修改要求：
${instruction}

请根据用户的要求和写作原则，在上一版本基础上重新生成该板块的内容。
- 只输出该板块的内容，不要包含板块标题（如【一、...】）
- 不要输出其他板块
- 不要输出 meta 数据块
- 不要输出分隔线（如 === 或 ---）`;
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

function isThinkingModel(modelName: string): boolean {
  return /qwen3/.test(modelName);
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

  const modelName = config.modelName || "qwen-plus";
  const thinking = isThinkingModel(modelName);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createParams: any = {
    model: modelName,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: config.temperature ?? 0.7,
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
        const message = err instanceof Error ? err.message : "生成过程中出错";
        controller.enqueue(new TextEncoder().encode(`\n\n---\n**错误**: ${message}`));
        controller.close();
      }
    },
  });
}

export async function POST(req: Request) {
  try {
    const { question, sectionKey, currentContent, allSections, instruction, provider, apiKey, config } =
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

    const systemPrompt = buildPrompt(sectionKey, question, currentContent, instruction, allSections);

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
