import { NextRequest } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const AUDIO_DIR = path.join(process.cwd(), "data", "audio");

// Detect actual content type from file magic bytes
function detectMimeType(buffer: Buffer): string {
  // MP4/M4A: starts with ftyp at offset 4
  if (buffer.length > 8 && buffer.toString("ascii", 4, 8) === "ftyp") {
    return "audio/mp4";
  }
  // WebM: starts with 0x1A45DFA3
  if (buffer.length > 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "audio/webm";
  }
  // OGG: starts with OggS
  if (buffer.length > 4 && buffer.toString("ascii", 0, 4) === "OggS") {
    return "audio/ogg";
  }
  // Fallback: let browser figure it out
  return "application/octet-stream";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    // Sanitize: only allow alphanumeric, dash, dot, underscore
    if (!/^[\w\-]+\.\w+$/.test(filename)) {
      return new Response("Invalid filename", { status: 400 });
    }

    const filepath = path.join(AUDIO_DIR, filename);
    const info = await stat(filepath);
    const buffer = await readFile(filepath);
    const contentType = detectMimeType(buffer);

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": info.size.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
