import { AnswerSections, AnswerMetadata, QuestionCategory } from "./types";

const SECTION_MARKERS = [
  { key: "answer" as const, pattern: /【一、[^】]*】/ },
  { key: "review" as const, pattern: /【二、[^】]*】/ },
  { key: "template" as const, pattern: /【三、[^】]*】/ },
  { key: "pitfalls" as const, pattern: /【四、[^】]*】/ },
  { key: "notes" as const, pattern: /【五、[^】]*】/ },
];

export function parseSections(raw: string): AnswerSections {
  const sections: AnswerSections = {
    answer: "",
    review: "",
    template: "",
    pitfalls: "",
    notes: "",
  };

  const cleanedRaw = raw.replace(/```meta[\s\S]*?```/g, "").trim();

  const positions: { key: keyof AnswerSections; start: number; headerEnd: number }[] = [];
  for (const marker of SECTION_MARKERS) {
    const match = cleanedRaw.match(marker.pattern);
    if (match && match.index !== undefined) {
      positions.push({
        key: marker.key,
        start: match.index,
        headerEnd: match.index + match[0].length,
      });
    }
  }

  positions.sort((a, b) => a.start - b.start);

  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const nextStart = i + 1 < positions.length ? positions[i + 1].start : cleanedRaw.length;
    sections[current.key] = cleanedRaw.slice(current.headerEnd, nextStart).trim();
  }

  if (positions.length === 0) {
    sections.answer = cleanedRaw;
  }

  return sections;
}

export function parseMetadata(raw: string): AnswerMetadata | null {
  const metaMatch = raw.match(/```meta\s*([\s\S]*?)\s*```/);
  if (!metaMatch) return null;

  try {
    const parsed = JSON.parse(metaMatch[1].trim());
    const validCategories: QuestionCategory[] = [
      "综合分析", "组织策划", "人际沟通", "情景模拟", "应急应变",
    ];
    const category = validCategories.includes(parsed.category)
      ? parsed.category
      : "综合分析";
    const validDifficulties = ["基础", "中等", "较难"] as const;
    const difficulty = validDifficulties.includes(parsed.difficulty)
      ? parsed.difficulty
      : "中等";

    const answerSection = parseSections(raw).answer;
    const wordCount = answerSection.replace(/\s/g, "").length;
    const minutes = Math.floor(wordCount / 220);
    const seconds = Math.round((wordCount / 220 - minutes) * 60);

    return {
      category,
      difficulty,
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      wordCount,
      estimatedTime: `${minutes}分${seconds.toString().padStart(2, "0")}秒`,
    };
  } catch {
    return null;
  }
}

export function stripMetaBlock(raw: string): string {
  return raw.replace(/\n*```meta[\s\S]*?```\s*$/, "").trim();
}

export function countWords(text: string): number {
  return text.replace(/\s/g, "").length;
}

/** Strip markdown formatting to plain text for TTS.
 *  Only removes markdown syntax, keeps original text structure intact. */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/>\s?/gm, "")
    .replace(/\|[^\n]+\|/g, "")
    .replace(/[-=]{3,}/g, "")
    .trim();
}
