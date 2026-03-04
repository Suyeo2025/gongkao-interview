import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { CustomVoice } from "./types";

const VOICES_DIR = join(process.cwd(), ".custom-voices");
const VOICES_JSON = join(VOICES_DIR, "voices.json");

function ensureDir() {
  if (!existsSync(VOICES_DIR)) {
    mkdirSync(VOICES_DIR, { recursive: true });
  }
}

export function listVoices(): CustomVoice[] {
  ensureDir();
  if (!existsSync(VOICES_JSON)) return [];
  try {
    return JSON.parse(readFileSync(VOICES_JSON, "utf-8"));
  } catch {
    return [];
  }
}

export function addVoice(voice: CustomVoice): void {
  ensureDir();
  const voices = listVoices();
  const existing = voices.findIndex((v) => v.voiceId === voice.voiceId);
  if (existing >= 0) {
    voices[existing] = voice;
  } else {
    voices.push(voice);
  }
  writeFileSync(VOICES_JSON, JSON.stringify(voices, null, 2));
}

export function removeVoice(voiceId: string): boolean {
  const voices = listVoices();
  const idx = voices.findIndex((v) => v.voiceId === voiceId);
  if (idx < 0) return false;
  voices.splice(idx, 1);
  writeFileSync(VOICES_JSON, JSON.stringify(voices, null, 2));
  return true;
}
