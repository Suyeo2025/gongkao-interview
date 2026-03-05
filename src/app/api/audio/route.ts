import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const AUDIO_DIR = path.join(process.cwd(), "data", "audio");

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const sessionId = form.get("sessionId") as string | null;
    const questionIndex = form.get("questionIndex") as string | null;

    if (!file || !sessionId || questionIndex == null) {
      return Response.json({ error: "Missing file, sessionId, or questionIndex" }, { status: 400 });
    }

    await mkdir(AUDIO_DIR, { recursive: true });

    const filename = `${sessionId}-${questionIndex}.webm`;
    const filepath = path.join(AUDIO_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    return Response.json({ url: `/api/audio/${filename}` });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
