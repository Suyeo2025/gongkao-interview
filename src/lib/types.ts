export type QuestionCategory =
  | "综合分析"
  | "组织策划"
  | "人际沟通"
  | "情景模拟"
  | "应急应变";

export interface Question {
  id: string;
  content: string;
  category: QuestionCategory | null;
  tags: string[];
  createdAt: string;
  isFavorite: boolean;
}

export interface AnswerSections {
  answer: string;
  review: string;
  template: string;
  pitfalls: string;
  notes: string;
}

export interface AnswerMetadata {
  category: QuestionCategory;
  difficulty: "基础" | "中等" | "较难";
  keyPoints: string[];
  wordCount: number;
  estimatedTime: string;
}

export interface Answer {
  id: string;
  questionId: string;
  rawMarkdown: string;
  sections: AnswerSections;
  metadata: AnswerMetadata | null;
  createdAt: string;
  modelUsed: string;
}

export interface QAPair {
  question: Question;
  answer: Answer;
}

export interface Settings {
  geminiApiKey: string;
  modelName: string;
  temperature: number;
}

export const DEFAULT_SETTINGS: Settings = {
  geminiApiKey: "",
  modelName: "gemini-2.5-flash",
  temperature: 0.7,
};

export const AVAILABLE_MODELS = [
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (最强)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (推荐)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (最快)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
];

export const CATEGORY_COLORS: Record<QuestionCategory, string> = {
  综合分析: "bg-blue-50 text-blue-600 border-blue-200/60",
  组织策划: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
  人际沟通: "bg-purple-50 text-purple-600 border-purple-200/60",
  情景模拟: "bg-orange-50 text-orange-600 border-orange-200/60",
  应急应变: "bg-rose-50 text-rose-600 border-rose-200/60",
};

export const ALL_CATEGORIES: QuestionCategory[] = [
  "综合分析",
  "组织策划",
  "人际沟通",
  "情景模拟",
  "应急应变",
];
