import { get, set, del, keys } from "idb-keyval";

const CACHE_VERSION = 3; // v3: per-voice cache keys

export interface WordTimestamp {
  text: string;
  beginTime: number; // ms
  endTime: number;   // ms
}

export interface CachedVoiceInfo {
  voice: string;
  model: string;
  voiceName: string;
  createdAt: string;
}

// ── Key helpers ──

/** Audio blob key: tts:{answerId}:{voice}:{model} */
function audioKey(answerId: string, voice: string, model: string): string {
  return `tts:${answerId}:${voice}:${model}`;
}

/** Lightweight index key: tts_idx:{answerId} */
function idxKey(answerId: string): string {
  return `tts_idx:${answerId}`;
}

function hashText(text: string, voice: string, model: string): string {
  const key = `${text.slice(0, 100)}_${text.length}_${voice}_${model}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return String(Math.abs(hash));
}

// ── Stored types ──

interface CachedAudio {
  blob: Blob;
  timestamps: WordTimestamp[];
  textHash: string;
  voice: string;
  model: string;
  voiceName: string;
  createdAt: string;
  version: number;
}

// ── Public API ──

export async function getCachedAudio(
  answerId: string,
  text: string,
  voice: string,
  model: string
): Promise<{ blob: Blob; timestamps: WordTimestamp[] } | null> {
  try {
    const cached = await get<CachedAudio>(audioKey(answerId, voice, model));
    if (!cached) return null;

    if (!cached.version || cached.version < CACHE_VERSION) {
      await del(audioKey(answerId, voice, model));
      return null;
    }

    const currentHash = hashText(text, voice, model);
    if (cached.textHash !== currentHash) {
      await del(audioKey(answerId, voice, model));
      // Also remove from index
      await removeFromIndex(answerId, voice, model);
      return null;
    }

    return { blob: cached.blob, timestamps: cached.timestamps || [] };
  } catch {
    return null;
  }
}

export async function setCachedAudio(
  answerId: string,
  blob: Blob,
  timestamps: WordTimestamp[],
  text: string,
  voice: string,
  model: string,
  voiceName: string
): Promise<void> {
  try {
    const entry: CachedAudio = {
      blob,
      timestamps,
      textHash: hashText(text, voice, model),
      voice,
      model,
      voiceName,
      createdAt: new Date().toISOString(),
      version: CACHE_VERSION,
    };
    await set(audioKey(answerId, voice, model), entry);

    // Update lightweight index
    const idx = await get<CachedVoiceInfo[]>(idxKey(answerId)) || [];
    const exists = idx.some(v => v.voice === voice && v.model === model);
    if (!exists) {
      idx.push({ voice, model, voiceName, createdAt: entry.createdAt });
      await set(idxKey(answerId), idx);
    }
  } catch {
    // Silently fail — cache is optional
  }
}

/** List all cached voice variants for an answer (fast — reads index only, no blobs). */
export async function listCachedVoices(answerId: string): Promise<CachedVoiceInfo[]> {
  try {
    return await get<CachedVoiceInfo[]>(idxKey(answerId)) || [];
  } catch {
    return [];
  }
}

export async function deleteCachedAudio(answerId: string): Promise<void> {
  try {
    // Delete all voice variants for this answer
    const allKeys = await keys();
    const prefix = `tts:${answerId}:`;
    for (const key of allKeys) {
      if (typeof key === "string" && key.startsWith(prefix)) {
        await del(key);
      }
    }
    // Delete index
    await del(idxKey(answerId));
  } catch {
    // Silently fail
  }
}

export async function clearAllCachedAudio(): Promise<number> {
  try {
    const allKeys = await keys();
    const ttsKeys = allKeys.filter(k =>
      typeof k === "string" && (k.startsWith("tts:") || k.startsWith("tts_idx:") || k.startsWith("tts_"))
    );
    for (const key of ttsKeys) {
      await del(key);
    }
    return ttsKeys.length;
  } catch {
    return 0;
  }
}

// ── Internal helpers ──

async function removeFromIndex(answerId: string, voice: string, model: string): Promise<void> {
  try {
    const idx = await get<CachedVoiceInfo[]>(idxKey(answerId));
    if (!idx) return;
    const filtered = idx.filter(v => !(v.voice === voice && v.model === model));
    if (filtered.length > 0) {
      await set(idxKey(answerId), filtered);
    } else {
      await del(idxKey(answerId));
    }
  } catch {
    // ignore
  }
}
