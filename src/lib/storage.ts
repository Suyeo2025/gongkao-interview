import { QAPair, Settings, DEFAULT_SETTINGS, Answer, SectionKey, SectionMeta, SectionVersion } from "./types";

const STORAGE_KEYS = {
  HISTORY: "gongkao_history",
  SETTINGS: "gongkao_settings",
} as const;

export function getHistory(): QAPair[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
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

export function generateId(prefix: string): string {
  const now = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}${now}${random}`;
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
