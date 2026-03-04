/**
 * Server-side TTS audio cache.
 * Persists audio files + timestamps to disk so they survive browser restarts.
 *
 * Cache layout:
 *   .tts-cache/
 *     {hash}.mp3         — raw audio
 *     {hash}.meta.json   — { timestamps, text, voice, model, createdAt }
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const CACHE_DIR = join(process.cwd(), ".tts-cache");

export interface WordTimestamp {
  text: string;
  beginTime: number;
  endTime: number;
}

interface CacheMeta {
  timestamps: WordTimestamp[];
  text: string;
  voice: string;
  model: string;
  createdAt: string;
}

function ensureDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheKey(text: string, voice: string, model: string): string {
  return createHash("md5")
    .update(`${text}||${voice}||${model}`)
    .digest("hex");
}

/**
 * Look up cached audio on disk.
 * Returns { audioBase64, timestamps } if found, null otherwise.
 */
export function getServerCachedAudio(
  text: string,
  voice: string,
  model: string
): { audioBase64: string; timestamps: WordTimestamp[] } | null {
  try {
    const key = cacheKey(text, voice, model);
    const audioPath = join(CACHE_DIR, `${key}.mp3`);
    const metaPath = join(CACHE_DIR, `${key}.meta.json`);

    if (!existsSync(audioPath) || !existsSync(metaPath)) return null;

    const audioBuffer = readFileSync(audioPath);
    const meta: CacheMeta = JSON.parse(readFileSync(metaPath, "utf-8"));

    return {
      audioBase64: audioBuffer.toString("base64"),
      timestamps: meta.timestamps,
    };
  } catch {
    return null;
  }
}

/**
 * Write audio + timestamps to disk cache.
 */
export function setServerCachedAudio(
  text: string,
  voice: string,
  model: string,
  audioBase64: string,
  timestamps: WordTimestamp[]
): void {
  try {
    ensureDir();
    const key = cacheKey(text, voice, model);

    // Write raw audio bytes
    const audioBuffer = Buffer.from(audioBase64, "base64");
    writeFileSync(join(CACHE_DIR, `${key}.mp3`), audioBuffer);

    // Write metadata
    const meta: CacheMeta = {
      timestamps,
      text: text.slice(0, 200), // Store snippet for debugging
      voice,
      model,
      createdAt: new Date().toISOString(),
    };
    writeFileSync(
      join(CACHE_DIR, `${key}.meta.json`),
      JSON.stringify(meta, null, 2)
    );
  } catch (err) {
    console.error("[TTS Cache] write error:", err);
  }
}
