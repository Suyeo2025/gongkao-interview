// ─── Section annotation & version types ──────────────────────────

export type SectionKey = "answer" | "review" | "template" | "pitfalls" | "notes";

export interface SectionAnnotation {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SectionVersion {
  id: string;
  content: string;
  source: "ai_original" | "manual_edit" | "ai_regenerate";
  instruction?: string;
  createdAt: string;
}

export interface SectionMeta {
  annotations: SectionAnnotation[];
  versions: SectionVersion[];
  currentVersionId: string;
}

// ─── Core types ──────────────────────────────────────────────────

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
  sectionMeta?: Record<SectionKey, SectionMeta>;
}

export interface QAPair {
  question: Question;
  answer: Answer;
  examSource?: {
    sessionId: string;
    questionIndex: number;
    mode: ExamMode;
  };
}

export interface CustomVoice {
  voiceId: string;       // DashScope 返回的 voice_id
  name: string;          // 用户起的名字
  targetModel: string;   // 创建时绑定的 TTS 模型
  createdAt: string;
}

export type TextProvider = "gemini" | "qwen";

export interface Settings {
  // Text generation
  textProvider: TextProvider;
  geminiApiKey: string;
  qwenApiKey: string;
  modelName: string;
  temperature: number;
  // TTS — 首页朗读
  dashscopeApiKey: string;
  ttsModel: string;
  ttsVoice: string;
  ttsRate: number;
  ttsInstruct: string;
  // Custom voice: set when a cloned voice is selected, empty for system voices
  customVoiceTargetModel: string;
  customVoiceName: string;
  // TTS — 导师语音 (独立配置，用于导师口吻回答朗读)
  mentorVoice: string;
  mentorInstruct: string;
  mentorVoiceName: string;
  mentorRate: number;
  mentorCustomTargetModel: string; // 自定义音色绑定模型，空=系统音色
  // Exam defaults
  defaultTimePerQuestion: number;
  defaultAdvanceMode: ExamAdvanceMode;
  defaultTotalExamTime: number; // seconds, default 1200 = 20 min
}

export const DEFAULT_SETTINGS: Settings = {
  textProvider: "gemini",
  geminiApiKey: "",
  qwenApiKey: "",
  modelName: "gemini-2.5-flash",
  temperature: 0.7,
  dashscopeApiKey: "",
  ttsModel: "cosyvoice-v3-flash",
  ttsVoice: "longanxuan_v3",
  ttsRate: 1.0,
  ttsInstruct: "",
  customVoiceTargetModel: "",
  customVoiceName: "",
  mentorVoice: "longanyang",
  mentorInstruct: "用严厉的语气朗读，像一个很凶的老师在训学生，语速偏快，语调强硬有压迫感，该骂就骂，不留情面",
  mentorVoiceName: "龙安洋 · 阳光男声",
  mentorRate: 1.0,
  mentorCustomTargetModel: "",
  defaultTimePerQuestion: 120,
  defaultAdvanceMode: "manual",
  defaultTotalExamTime: 1200,
};

export const AVAILABLE_MODELS = [
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (最强)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (推荐)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (最快)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
];

export const QWEN_MODELS = [
  { value: "qwen-max", label: "Qwen Max (最强)" },
  { value: "qwen-plus", label: "Qwen Plus (推荐)" },
  { value: "qwen-turbo", label: "Qwen Turbo (最快)" },
];

export const TTS_MODELS = [
  { value: "cosyvoice-v3-flash", label: "CosyVoice v3 Flash (推荐)" },
  { value: "cosyvoice-v3-plus", label: "CosyVoice v3 Plus" },
];

// Fallback voices - used when API fetch fails
export const TTS_VOICES_FALLBACK = [
  { id: "longanxuan_v3", name: "龙安宣 · 经典直播女", category: "直播", instruct: false, timestamp: true },
  { id: "longanyang", name: "龙安洋 · 阳光男声", category: "社交陪伴", instruct: true, timestamp: true },
  { id: "longanhuan", name: "龙安欢 · 活泼女声", category: "社交陪伴", instruct: true, timestamp: true },
];

export const TTS_RATES = [
  { value: 0.5, label: "0.5" },
  { value: 0.75, label: "0.75" },
  { value: 0.85, label: "0.85" },
  { value: 1.0, label: "1.0" },
  { value: 1.1, label: "1.1" },
  { value: 1.25, label: "1.25" },
  { value: 1.4, label: "1.4" },
  { value: 1.5, label: "1.5" },
  { value: 1.75, label: "1.75" },
  { value: 2.0, label: "2.0" },
];

/** Voice ID → display name map (client-side lookup) */
export const TTS_VOICE_NAMES: Record<string, string> = {
  longanxuan_v3: "龙安宣 · 经典直播女",
  longanyang: "龙安洋 · 阳光男声",
  longanhuan: "龙安欢 · 活泼女声",
  longhuhu_v3: "龙呼呼 · 天真女童",
  longpaopao_v3: "龙泡泡 · 活力童声",
  longjielidou_v3: "龙杰力豆 · 阳光男童",
  longxian_v3: "龙仙 · 可爱女童",
  longling_v3: "龙铃 · 天真女童",
  longshanshan_v3: "龙闪闪 · 故事童声",
  longniuniu_v3: "龙牛牛 · 阳光男童",
  longjiaxin_v3: "龙嘉欣 · 粤语女声",
  longjiayi_v3: "龙嘉怡 · 粤语女声",
  longanyue_v3: "龙安粤 · 粤语男声",
  longlaotie_v3: "龙老铁 · 东北男声",
  longshange_v3: "龙陕哥 · 陕西男声",
  longanmin_v3: "龙安闽 · 闽南女声",
  longfei_v3: "龙飞 · 诗词朗诵",
  longyingxiao_v3: "龙应笑 · 电销女声",
  longyingxun_v3: "龙应询 · 客服男声",
  longyingjing_v3: "龙应静 · 客服女声",
  longyingling_v3: "龙应聆 · 温柔客服",
  longyingtao_v3: "龙应桃 · 甜美客服",
  longxiaochun_v3: "龙小淳 · 温柔助手",
  longxiaoxia_v3: "龙小夏 · 活力助手",
  longyumi_v3: "YUMI · 元气助手",
  longanyun_v3: "龙安昀 · 知性助手",
  longanwen_v3: "龙安温 · 温暖男声",
  longanli_v3: "龙安莉 · 亲切女声",
  longanlang_v3: "龙安朗 · 标准男声",
  longyingmu_v3: "龙应沐 · 沉稳男声",
  longantai_v3: "龙安台 · 台湾女声",
  longhua_v3: "龙华 · 甜美女声",
  longcheng_v3: "龙橙 · 阳光男声",
  longze_v3: "龙泽 · 温暖男声",
  longzhe_v3: "龙哲 · 暖心男声",
};

// ─── Exam / Question Bank types ─────────────────────────────────

export interface BankQuestion {
  id: string;
  content: string;
  category: QuestionCategory | null;
  tags: string[];
  source: "manual" | "file_upload" | "homepage" | "edit_derived";
  sourceFile?: string;
  derivedFrom?: string;
  createdAt: string;
}

export type ExamAdvanceMode = "auto" | "manual";
export type ExamMode = "practice" | "exam";

export interface ExamPaperQuestion {
  bankQuestionId: string;
  questionContent: string;
  timeLimit: number;
  order: number;
}

export interface ExamPaper {
  id: string;
  name: string;
  questions: ExamPaperQuestion[];
  advanceMode: ExamAdvanceMode;
  totalTimeLimit?: number; // seconds, exam mode only (e.g. 1200 = 20 min)
  createdAt: string;
}

export type ExamSessionStatus = "in_progress" | "completed";

export interface ASRWord {
  text: string;
  beginTime: number;
  endTime: number;
  punctuation?: string;
}

export interface ExamEvaluation {
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string;
  /** 完整导师口头评价（eval块外的文本），用于TTS朗读 */
  fullCommentary?: string;
  modelUsed: string;
  evaluatedAt: string;
}

export interface ExamQuestionAnswer {
  questionIndex: number;
  questionContent: string;
  asrTranscript: string;
  asrWords: ASRWord[];
  timeSpent: number;
  timeLimit: number;
  startedAt: string;
  finishedAt: string;
  audioUrl?: string;
  evaluation?: ExamEvaluation;
}

export interface ExamSession {
  id: string;
  paperId: string;
  paperName: string;
  mode: ExamMode;
  status: ExamSessionStatus;
  currentQuestionIndex: number;
  answers: ExamQuestionAnswer[];
  startedAt: string;
  finishedAt?: string;
  totalScore?: number;
  createdAt: string;
}

export const CATEGORY_COLORS: Record<QuestionCategory, string> = {
  综合分析: "bg-blue-50 text-blue-600 border-blue-200/60",
  组织策划: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
  人际沟通: "bg-teal-50 text-teal-600 border-teal-200/60",
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
