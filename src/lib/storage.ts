import { QAPair, Settings, DEFAULT_SETTINGS, Answer, SectionKey, SectionMeta, SectionVersion, BankQuestion, ExamPaper, ExamSession, ExamEvaluation } from "./types";

const STORAGE_KEYS = {
  HISTORY: "gongkao_history",
  SETTINGS: "gongkao_settings",
  QUESTION_BANK: "gongkao_question_bank",
  EXAM_PAPERS: "gongkao_exam_papers",
  EXAM_SESSIONS: "gongkao_exam_sessions",
  MENTOR_EVALS: "gongkao_mentor_evals",
} as const;

export function getHistory(): QAPair[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    const history: QAPair[] = raw ? JSON.parse(raw) : [];
    // Deduplicate by question.id (keep first = most recent)
    const seenIds = new Set<string>();
    const deduped = history.filter((p) => {
      if (seenIds.has(p.question.id)) return false;
      seenIds.add(p.question.id);
      return true;
    });
    // Persist cleaned data if duplicates were found
    if (deduped.length < history.length) {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(deduped));
    }
    return deduped;
  } catch {
    return [];
  }
}

export function saveHistory(history: QAPair[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

export function addQAPair(pair: QAPair) {
  const history = getHistory();
  history.unshift(pair);
  saveHistory(history);
  return history;
}

export function updateQAPair(
  questionId: string,
  updater: (pair: QAPair) => QAPair
) {
  const history = getHistory();
  const idx = history.findIndex((p) => p.question.id === questionId);
  if (idx !== -1) {
    history[idx] = updater(history[idx]);
    saveHistory(history);
  }
  return history;
}

export function deleteQAPair(questionId: string) {
  const history = getHistory().filter((p) => p.question.id !== questionId);
  saveHistory(history);
  return history;
}

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

let _idCounter = 0;
export function generateId(prefix: string): string {
  const now = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const seq = (++_idCounter).toString(36);
  return `${prefix}${now}${random}${seq}`;
}

const SECTION_KEYS: SectionKey[] = ["answer", "review", "template", "pitfalls", "notes"];

export function ensureSectionMeta(answer: Answer): Answer {
  if (answer.sectionMeta) return answer;

  const sectionMeta = {} as Record<SectionKey, SectionMeta>;
  for (const key of SECTION_KEYS) {
    const initialVersion: SectionVersion = {
      id: generateId("ver_"),
      content: answer.sections[key],
      source: "ai_original",
      createdAt: answer.createdAt,
    };
    sectionMeta[key] = {
      annotations: [],
      versions: [initialVersion],
      currentVersionId: initialVersion.id,
    };
  }
  return { ...answer, sectionMeta };
}

// ─── Question Bank ───────────────────────────────────────────────

export function getQuestionBank(): BankQuestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUESTION_BANK);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveQuestionBank(bank: BankQuestion[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(bank));
}

// ─── Exam Papers ─────────────────────────────────────────────────

export function getExamPapers(): ExamPaper[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXAM_PAPERS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveExamPapers(papers: ExamPaper[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(papers));
}

// ─── Exam Sessions ───────────────────────────────────────────────

export function getExamSessions(): ExamSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXAM_SESSIONS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveExamSessions(sessions: ExamSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(sessions));
}

// ─── Mentor Evaluations (homepage) ──────────────────────────────

export interface MentorEvalVersion {
  id: string;
  evaluation: ExamEvaluation;
  fullText: string; // raw streaming text (with eval blocks stripped)
  createdAt: string;
}

/** answerId → versions[] */
type MentorEvalStore = Record<string, MentorEvalVersion[]>;

function getMentorEvalStore(): MentorEvalStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MENTOR_EVALS);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveMentorEvalStore(store: MentorEvalStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.MENTOR_EVALS, JSON.stringify(store));
}

export function getMentorEvals(answerId: string): MentorEvalVersion[] {
  return getMentorEvalStore()[answerId] || [];
}

export function addMentorEval(answerId: string, evaluation: ExamEvaluation, fullText: string): MentorEvalVersion {
  const store = getMentorEvalStore();
  const version: MentorEvalVersion = {
    id: generateId("mev_"),
    evaluation,
    fullText,
    createdAt: new Date().toISOString(),
  };
  store[answerId] = [version, ...(store[answerId] || [])];
  saveMentorEvalStore(store);
  return version;
}

export function deleteMentorEval(answerId: string, versionId: string) {
  const store = getMentorEvalStore();
  if (!store[answerId]) return;
  store[answerId] = store[answerId].filter((v) => v.id !== versionId);
  if (store[answerId].length === 0) delete store[answerId];
  saveMentorEvalStore(store);
}

// ─── Export / Import ─────────────────────────────────────────────

export function exportData(): string {
  const history = getHistory();
  const settings = getSettings();
  return JSON.stringify({ history, settings, exportedAt: new Date().toISOString() }, null, 2);
}

export function importData(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if (data.history) saveHistory(data.history);
    if (data.settings) saveSettings(data.settings);
    return true;
  } catch {
    return false;
  }
}
